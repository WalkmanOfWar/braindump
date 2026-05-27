'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Brain, Calendar } from 'lucide-react'

const CONFIDENCE_LEVELS = [
  { value: 1, emoji: '😵', label: 'Nie rozumiem', days: 1, color: 'border-destructive/40 bg-destructive/10 text-destructive' },
  { value: 2, emoji: '😕', label: 'Słabo', days: 3, color: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  { value: 3, emoji: '😐', label: 'Podstawy', days: 7, color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  { value: 4, emoji: '😊', label: 'Dobrze', days: 14, color: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400' },
  { value: 5, emoji: '🚀', label: 'Opanowane', days: 30, color: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400' },
]

interface SessionConfidenceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTopic: string
  onConfirm: (confidence: number) => void
}

export function SessionConfidenceModal({
  open,
  onOpenChange,
  sessionTopic,
  onConfirm,
}: SessionConfidenceModalProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const selectedLevel = CONFIDENCE_LEVELS.find((l) => l.value === selected)

  const handleConfirm = () => {
    if (!selected) return
    onConfirm(selected)
    onOpenChange(false)
    setSelected(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onConfirm(3); setSelected(null) } onOpenChange(o) }}>
      <DialogContent className="sm:max-w-[420px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Jak poszło?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Temat: <span className="font-medium text-foreground">{sessionTopic}</span>
        </p>

        <div className="space-y-2 py-1">
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setSelected(level.value)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all',
                selected === level.value
                  ? level.color + ' ring-1 ring-inset ring-current'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <span className="text-2xl shrink-0">{level.emoji}</span>
              <div className="flex-1">
                <span className="font-medium text-sm">{level.label}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Calendar className="w-3 h-3" />
                {level.days === 1 ? 'jutro' : level.days < 7 ? `za ${level.days} dni` : level.days === 7 ? 'za tydzień' : level.days === 14 ? 'za 2 tygodnie' : 'za miesiąc'}
              </div>
            </button>
          ))}
        </div>

        {selectedLevel && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            Następna powtórka tematu zostanie zaplanowana{' '}
            <span className="font-medium text-foreground">
              {selectedLevel.days === 1 ? 'jutro' : selectedLevel.days < 7 ? `za ${selectedLevel.days} dni` : selectedLevel.days === 7 ? 'za tydzień' : selectedLevel.days === 14 ? 'za 2 tygodnie' : 'za miesiąc'}
            </span>
            .
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => { onConfirm(3); onOpenChange(false); setSelected(null) }}>
            Pomiń
          </Button>
          <Button size="sm" disabled={!selected} onClick={handleConfirm}>
            Zaplanuj powtórkę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
