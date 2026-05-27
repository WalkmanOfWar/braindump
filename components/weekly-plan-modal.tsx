'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Calendar, Target, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import type { WeeklyPlan } from '@/types'

function getMondayISO(date = new Date()): string {
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff))
  return monday.toISOString().slice(0, 10)
}

function formatWeekRange(mondayISO: string): string {
  const monday = new Date(mondayISO + 'T00:00:00Z')
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

interface WeeklyPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WeeklyPlanModal({ open, onOpenChange }: WeeklyPlanModalProps) {
  const weekStart = getMondayISO()
  const [priority1, setPriority1] = useState('')
  const [priority2, setPriority2] = useState('')
  const [priority3, setPriority3] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSaved(false)
    fetch(`/api/weekly-plan?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((plan: WeeklyPlan | null) => {
        if (plan) {
          setPriority1(plan.priority1 ?? '')
          setPriority2(plan.priority2 ?? '')
          setPriority3(plan.priority3 ?? '')
          setNotes(plan.notes ?? '')
        } else {
          setPriority1('')
          setPriority2('')
          setPriority3('')
          setNotes('')
        }
      })
      .catch(() => toast.error('Nie udało się załadować planu'))
      .finally(() => setLoading(false))
  }, [open, weekStart])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, priority1: priority1.trim() || null, priority2: priority2.trim() || null, priority3: priority3.trim() || null, notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      toast.success('Plan tygodnia zapisany!')
      setTimeout(() => onOpenChange(false), 800)
    } catch {
      toast.error('Nie udało się zapisać planu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Plan tygodnia
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{formatWeekRange(weekStart)}</p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-primary">Newport & GTD:</span> Tygodniowy przegląd celów zmniejsza reaktywność i zwiększa pracę nad tym co ważne (Q2), nie tylko pilne (Q1).
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <Target className="w-3.5 h-3.5 text-primary" />
                Top 3 priorytety na ten tydzień
              </Label>
              {[
                { num: 1, value: priority1, set: setPriority1 },
                { num: 2, value: priority2, set: setPriority2 },
                { num: 3, value: priority3, set: setPriority3 },
              ].map(({ num, value, set }) => (
                <div key={num} className="flex gap-2 items-start">
                  <span className="mt-2.5 text-xs font-bold text-primary shrink-0 w-5 text-center">{num}.</span>
                  <Textarea
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={
                      num === 1 ? 'Najważniejsza rzecz do zrobienia w tym tygodniu…'
                      : num === 2 ? 'Drugie ważne zadanie lub cel…'
                      : 'Trzeci priorytet na ten tydzień…'
                    }
                    rows={2}
                    className="resize-none text-sm"
                    maxLength={200}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Notatki / refleksja</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Co poszło dobrze w zeszłym tygodniu? Co chcę poprawić? Bloki głębokiej pracy…"
                rows={3}
                className="resize-none text-sm"
                maxLength={1000}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || saved}
            className="gap-1.5"
          >
            {saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Zapisano</>
            ) : saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Zapisuję…</>
            ) : (
              'Zapisz plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
