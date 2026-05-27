'use client'

import { useState } from 'react'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Miller's Law: 7±2 items in working memory.
// For tasks, research suggests >15 active tasks causes significant cognitive load.
const COGNITIVE_LOAD_THRESHOLD = 15

interface CognitiveLoadBannerProps {
  activeTaskCount: number
  className?: string
}

export function CognitiveLoadBanner({ activeTaskCount, className }: CognitiveLoadBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (activeTaskCount <= COGNITIVE_LOAD_THRESHOLD || dismissed) return null

  const excess = activeTaskCount - COGNITIVE_LOAD_THRESHOLD

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3',
        className
      )}
    >
      <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Masz {activeTaskCount} aktywnych zadań
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Badania (Miller, 1956) sugerują, że &gt;{COGNITIVE_LOAD_THRESHOLD} zadań obciąża pamięć roboczą.
          Rozważ zamknięcie lub postponowanie ~{excess}.
        </p>
        <a
          href="/tasks"
          className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium mt-1.5 hover:underline"
        >
          Przejrzyj zadania <ArrowRight className="w-3 h-3" />
        </a>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Zamknij"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
