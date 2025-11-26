"use client"

import React, { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "../../lib/utils"

const Select = ({ children, value, onValueChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || "")
  const [selectedLabel, setSelectedLabel] = useState("")
  const [itemsMap, setItemsMap] = useState(new Map())

  // Extrair todos os SelectItems e mapear value -> label
  useEffect(() => {
    const extractItems = (children) => {
      const items = new Map()
      const processChild = (child) => {
        if (!React.isValidElement(child)) return
        
        if (child.type?.displayName === "SelectItem") {
          const childValue = child.props.value
          let childLabel = ''
          
          if (typeof child.props.children === 'string') {
            childLabel = child.props.children
          } else if (Array.isArray(child.props.children)) {
            // Para arrays de children (múltiplos elementos JSX), junta sem vírgulas
            childLabel = child.props.children.map(c => {
              if (typeof c === 'string') return c
              if (typeof c === 'number') return String(c)
              return ''
            }).join('')
          } else {
            childLabel = child.props.children?.toString() || ''
          }
          
          items.set(String(childValue), childLabel)
        } else if (child.props?.children) {
          if (Array.isArray(child.props.children)) {
            child.props.children.forEach(processChild)
          } else {
            processChild(child.props.children)
          }
        }
      }
      
      if (Array.isArray(children)) {
        children.forEach(processChild)
      } else {
        processChild(children)
      }
      
      return items
    }

    const items = extractItems(children)
    setItemsMap(items)
  }, [children])

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
      const label = itemsMap.get(String(value)) || ""
      setSelectedLabel(label)
    }
  }, [value, itemsMap])

  const handleValueChange = (newValue, newLabel) => {
    setSelectedValue(newValue)
    setSelectedLabel(newLabel || itemsMap.get(String(newValue)) || "")
    setIsOpen(false)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  return (
    <SelectContext.Provider
      value={{
        isOpen,
        setIsOpen,
        selectedValue,
        selectedLabel,
        handleValueChange,
        disabled,
        itemsMap,
      }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

const SelectContext = React.createContext()

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, disabled } = React.useContext(SelectContext)

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={() => !disabled && setIsOpen(!isOpen)}
      disabled={disabled}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }) => {
  const { selectedValue, selectedLabel } = React.useContext(SelectContext)

  return <span className={cn(!selectedValue && "text-muted-foreground")}>{selectedLabel || placeholder}</span>
}

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext)
  const contentRef = useRef()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contentRef.current && !contentRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { selectedValue, handleValueChange } = React.useContext(SelectContext)
  const isSelected = String(selectedValue) === String(value)
  
  const handleClick = () => {
    // Extrair texto limpo dos children, sem vírgulas extras
    let label = ''
    if (typeof children === 'string') {
      label = children
    } else if (Array.isArray(children)) {
      // Para arrays de children (múltiplos elementos JSX), junta sem vírgulas
      label = children.map(child => {
        if (typeof child === 'string') return child
        if (typeof child === 'number') return String(child)
        if (React.isValidElement(child)) {
          // Se é um elemento React, tenta extrair o texto
          return child.props?.children?.toString() || ''
        }
        return child?.toString() || ''
      }).join('')
    } else if (React.isValidElement(children)) {
      label = children.props?.children?.toString() || ''
    } else {
      label = children?.toString() || ''
    }
    
    // Remove vírgulas extras e limpa espaços duplos
    label = label.replace(/\s+/g, ' ').trim()
    
    handleValueChange(value, label)
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
