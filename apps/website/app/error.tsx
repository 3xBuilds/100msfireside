'use client'

import { useEffect } from 'react'
import Button from '@/components/UI/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-bold text-red-500">Something went wrong!</h2>
        <p className="text-gray-600 dark:text-gray-400">
          We encountered an unexpected error. Please try again.
        </p>
        {error.message && (
          <p className="text-sm text-gray-500 dark:text-gray-500 font-mono">
            {error.message}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => window.location.href = '/'}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
