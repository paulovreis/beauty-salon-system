"use client"

import React, { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

const Calendar = React.forwardRef(({ className, selected, onSelect, mode = "single", ...props }, ref) => {
  const [currentDate, setCurrentDate] = useState(selected || new Date())

  const today = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const previousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1))
  }

  const selectDate = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day)
    if (onSelect) {
      onSelect(selectedDate)
    }
  }

  const isSelected = (day) => {
    if (!selected) return false
    const date = new Date(currentYear, currentMonth, day)
    return selected.toDateString() === date.toDateString()
  }

  const isToday = (day) => {
    const date = new Date(currentYear, currentMonth, day)
    return today.toDateString() === date.toDateString()
  }

  const renderCalendarDays = () => {
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(
        <button
          key={day}
          onClick={() => selectDate(day)}
          className={cn(
            "p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground font-medium",
          )}
        >
          {day}
        </button>,
      )
    }

    return days
  }

  return (
    <div ref={ref} className={cn("p-3", className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={previousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {monthNames[currentMonth]} {currentYear}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="p-2 text-xs font-medium text-muted-foreground text-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>
    </div>
  )
})
Calendar.displayName = "Calendar"

export { Calendar }
