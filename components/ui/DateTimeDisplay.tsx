'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar } from 'lucide-react'

const DateTimeDisplay = () => {
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setCurrentDateTime(new Date())

    // Schedule first update after mount without calling setState synchronously in the effect body
    const initial = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)

    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Show loading state during hydration
  if (!currentDateTime) {
    return (
      <div className="flex items-center gap-2 md:gap-3">
        {/* Date Display - Hidden on mobile */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:border-slate-600/50">
          <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Loading...
          </span>
        </div>

        {/* Time Display - Always visible */}
        <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-600/50">
          <Clock className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
            --:--:--
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Date Display - Hidden on mobile */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:border-slate-600/50">
        <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {formatDate(currentDateTime)}
        </span>
      </div>

      {/* Time Display - Always visible */}
      <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-600/50">
        <Clock className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
          {formatTime(currentDateTime)}
        </span>
      </div>
    </div>
  )
}

export default DateTimeDisplay 