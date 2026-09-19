'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, readTheme, type Theme } from '@/lib/workspace'

export function ThemeToggle({ className = '' }: { className?: string }) {
  // Rendered light on the server; corrected on mount before anyone can click.
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    setTheme(readTheme())
  }, [])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next)
        setTheme(next)
      }}
      className={`ws-btn ws-btn-ghost ws-btn-sm ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
