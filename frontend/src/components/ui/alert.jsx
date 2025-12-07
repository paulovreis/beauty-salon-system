import React from "react"
import { cn } from "../../lib/utils"

const Alert = React.forwardRef(({ className, variant = "default", onClose, ...props }, ref) => {
  const variants = {
    default: "bg-background text-foreground border-gray-300",
    destructive: "bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400",
    success: "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400",
    warning: "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400",
  }

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "relative w-full rounded-lg border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
        variants[variant],
        className,
      )}
      {...props}
    >
      {props.children}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-current opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Fechar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
