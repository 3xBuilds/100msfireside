'use client'

import { useState, useRef, useEffect } from "react"
import { twMerge } from "tailwind-merge"

interface DateTimePickerProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  minDate?: Date
}

export default function DateTimePicker({
  label,
  value,
  onChange,
  placeholder = "Select date and time",
  disabled = false,
  required = false,
  className = '',
  id,
  minDate
}: DateTimePickerProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(value)
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value.getFullYear(), value.getMonth()) : new Date())

  const datePickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const inputId = id || `datetime-${label.toLowerCase().replace(/\s+/g, '-')}`
  const hasValue = value !== null
  const showError = required && hasInteracted && !hasValue

  // Generate time options
  const generateHourOptions = () => {
    const hours = []
    for (let i = 1; i <= 12; i++) {
      hours.push(i)
    }
    return hours
  }

  const generateMinuteOptions = () => {
    const minutes = []
    for (let i = 0; i < 60; i++) {
      minutes.push(i)
    }
    return minutes
  }

  const hourOptions = generateHourOptions()
  const minuteOptions = generateMinuteOptions()
  const periodOptions = ['AM', 'PM']

  // Format display value
  const formatDisplayValue = (date: Date | null) => {
    if (!date) return ''
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    return date.toLocaleDateString('en-US', options)
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const isDateDisabled = (date: Date) => {
    if (minDate) {
      const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const compareMinDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
      return compareDate < compareMinDate
    }
    return false
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    
    if (isDateDisabled(newDate)) return

    if (selectedDate) {
      // Preserve existing time
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes())
    } else {
      // Set default time to current time
      const now = new Date()
      newDate.setHours(now.getHours(), now.getMinutes())
    }

    setSelectedDate(newDate)
    onChange(newDate)
    setIsDatePickerOpen(false)
  }

  const handleTimeSelect = (timeType: 'hour' | 'minute' | 'period', value: number | string) => {
    let newDate = selectedDate || new Date()
    newDate = new Date(newDate)
    
    let currentHour = newDate.getHours()
    let currentMinute = newDate.getMinutes()
    
    // Convert 24-hour to 12-hour for display
    let displayHour = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour
    let period = currentHour >= 12 ? 'PM' : 'AM'
    
    if (timeType === 'hour') {
      displayHour = value as number
    } else if (timeType === 'minute') {
      currentMinute = value as number
    } else if (timeType === 'period') {
      period = value as string
    }
    
    // Convert back to 24-hour format
    let hour24 = displayHour
    if (period === 'AM' && displayHour === 12) {
      hour24 = 0
    } else if (period === 'PM' && displayHour !== 12) {
      hour24 = displayHour + 12
    }
    
    newDate.setHours(hour24, currentMinute, 0, 0)
    
    setSelectedDate(newDate)
    onChange(newDate)
  }

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1)
      } else {
        newMonth.setMonth(prev.getMonth() + 1)
      }
      return newMonth
    })
  }

  const handleInputClick = () => {
    if (!disabled) {
      setIsFocused(true)
      setHasInteracted(true)
      setIsDatePickerOpen(true)
    }
  }

  const handleClear = () => {
    setSelectedDate(null)
    onChange(null)
    setIsDatePickerOpen(false)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Render calendar days
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const isSelected = selectedDate && 
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear()
      const isDisabled = isDateDisabled(date)
      const isToday = new Date().toDateString() === date.toDateString()

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          disabled={isDisabled}
          className={twMerge(
            'p-2 text-sm rounded-lg transition-all text-white hover:bg-gray-800',
            isSelected && 'bg-fireside-orange text-white hover:bg-fireside-orange/90',
            isToday && !isSelected && 'bg-white/10 text-fireside-orange font-semibold',
            isDisabled && 'text-gray-600 cursor-not-allowed hover:bg-transparent',
            !isSelected && !isToday && !isDisabled && 'hover:bg-gray-800'
          )}
        >
          {day}
        </button>
      )
    }

    return days
  }

  return (
    <div className={twMerge('w-full', className)}>
      {/* Label */}
      <label
        htmlFor={inputId}
        className={twMerge(
          'block text-sm font-medium mb-2',
          disabled && 'text-disabled',
          showError && 'text-fireside-red',
          !showError && 'text-gray-300'
        )}
      >
        {label}
        {required && <span className="text-fireside-red ml-1">*</span>}
      </label>

      {/* Input Field */}
      <div className="relative w-full text-white">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={formatDisplayValue(selectedDate)}
          onClick={handleInputClick}
          onFocus={() => {
            setIsFocused(true)
            setHasInteracted(true)
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly
          className={twMerge(
            'w-full px-4 py-3 pr-12 rounded-lg border-[1px] bg-transparent transition-all duration-200 cursor-pointer text-foreground',
            disabled && 'border-disabled cursor-not-allowed opacity-60',
            !disabled && (isFocused || hasValue) && showError && 'border-fireside-red outline-fireside-red',
            !disabled && (isFocused || hasValue) && !showError && 'border-fireside-orange outline-fireside-orange',
            !disabled && !(isFocused || hasValue) && 'border-gray-300 hover:border-gray-400',
            isFocused && 'outline-1 outline-offset-1'
          )}
        />
        
        {/* Calendar Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-1">
          {hasValue && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      
      {/* Date Picker Dropdown */}
      {isDatePickerOpen && (
        <div
          ref={datePickerRef}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === datePickerRef.current) {
              setIsDatePickerOpen(false);
            }
          }}
        >
          <div
            className="bg-black border-[1px] border-fireside-orange/30 rounded-lg shadow-2xl p-4 min-w-[320px] max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => handleMonthChange('prev')}
                className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-semibold text-lg text-white">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                type="button"
                onClick={() => handleMonthChange('next')}
                className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {renderCalendarDays()}
            </div>

            {/* Time Selection */}
            <div className="border-t border-gray-700 pt-4">
              <div className="mb-3">
                <span className="text-sm font-medium text-white mb-2 block">Time:</span>
                <div className="flex items-center gap-2">
                  {/* Hour Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedDate ? (selectedDate.getHours() === 0 ? 12 : selectedDate.getHours() > 12 ? selectedDate.getHours() - 12 : selectedDate.getHours()) : 12}
                      onChange={(e) => handleTimeSelect('hour', parseInt(e.target.value))}
                      className="px-3 py-2 border border-caption rounded-lg hover:border-fireside-orange transition-colors text-sm w-[60px] bg-white/10 text-white"
                    >
                      {hourOptions.map(hour => (
                        <option key={hour} value={hour} className="bg-black w-1/2 text-white">
                          {hour}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <span className="text-gray-400 font-medium">:</span>
                  
                  {/* Minute Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedDate ? selectedDate.getMinutes() : 0}
                      onChange={(e) => handleTimeSelect('minute', parseInt(e.target.value))}
                      className="px-3 py-2 border border-caption rounded-lg hover:border-fireside-orange transition-colors text-sm min-w-[60px] bg-white/10 text-white"
                    >
                      {minuteOptions.map(minute => (
                        <option key={minute} value={minute} className="bg-black text-white">
                          {minute.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* AM/PM Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedDate ? (selectedDate.getHours() >= 12 ? 'PM' : 'AM') : 'AM'}
                      onChange={(e) => handleTimeSelect('period', e.target.value)}
                      className="px-3 py-2 border border-caption rounded-lg hover:border-fireside-orange transition-colors text-sm min-w-[60px] bg-white/10 text-white"
                    >
                      {periodOptions.map(period => (
                        <option key={period} value={period} className="bg-black text-white">
                          {period}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {showError && (
        <p className="text-fireside-red text-sm mt-1 ml-1">
          {label} is required
        </p>
      )}
    </div>
  )
}