'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Zap } from 'lucide-react'

const LEVELS = [
  { value: 1, emoji: '😴', label: 'Ledwo żyję' },
  { value: 2, emoji: '😪', label: 'Słabo' },
  { value: 3, emoji: '😐', label: 'Przeciętnie' },
  { value: 4, emoji: '😊', label: 'Dobrze' },
  { value: 5, emoji: '🚀', label: 'Pełna moc' },
]

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

interface EnergyCheckInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckedIn?: (level: number) => void
}

export function EnergyCheckInModal({ open, onOpenChange, onCheckedIn }: EnergyCheckInModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setSelected(null)
  }, [open])

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/energy-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: getTodayStr(), level: selected }),
      })
      if (!res.ok) throw new Error()
      onCheckedIn?.(selected)
      onOpenChange(false)
    } catch {
      toast.error('Nie udało się zapisać energy check-in')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Jaka twoja energia dziś?
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          30 sekund. Pomaga dopasować zadania do twojego stanu.
        </p>

        <div className="grid grid-cols-5 gap-2 py-2">
          {LEVELS.map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-3 px-1 border-2 transition-all',
                selected === value
                  ? 'border-primary bg-primary/10 scale-105'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
            Pomiń
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={!selected || saving}
            onClick={handleSave}
          >
            {saving ? 'Zapisuję…' : 'Zapisz'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to auto-show the modal once per day
export function useEnergyCheckIn() {
  const [open, setOpen] = useState(false)
  const [todayLevel, setTodayLevel] = useState<number | null>(null)

  useEffect(() => {
    const today = getTodayStr()
    const storageKey = `energy-checkin-${today}`

    const stored = localStorage.getItem(storageKey)
    if (stored) {
      // Restore today's level from cache — don't show the modal again
      setTodayLevel(Number(stored))
      return
    }

    // Only auto-prompt between 05:00 and 14:00
    const hour = new Date().getHours()
    if (hour < 5 || hour >= 14) return

    // Check if already submitted today (in case of page refresh without cache)
    fetch(`/api/energy-checkin?date=${today}`)
      .then((r) => r.json())
      .then((data: { level?: number } | null) => {
        if (data?.level) {
          setTodayLevel(data.level)
          localStorage.setItem(storageKey, String(data.level))
        } else {
          // Slight delay so it doesn't pop instantly on load
          setTimeout(() => setOpen(true), 1500)
        }
      })
      .catch(() => {/* silently skip */})
  }, [])

  const handleCheckedIn = (level: number) => {
    setTodayLevel(level)
    localStorage.setItem(`energy-checkin-${getTodayStr()}`, String(level))
  }

  return { open, setOpen, todayLevel, handleCheckedIn }
}
