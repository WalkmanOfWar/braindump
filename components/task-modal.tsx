'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Plus, Check, Sparkles, Loader2, Trash2, RepeatIcon, Timer, MapPin, ChevronDown, ChevronUp, Zap, Brain, Battery } from 'lucide-react'
import type { UiTask, Category, Recurrence, Subtask, EnergyLevel } from '@/types'
import { nanoid } from 'nanoid'

/** datetime-local inputs expect YYYY-MM-DDTHH:MM in LOCAL time, not UTC. */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#000000',
]

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: UiTask | null
  categories?: Category[]
  onSave: (task: Partial<UiTask>) => void
  onCategoryCreated?: (category: Category) => void
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  categories = [],
  onSave,
  onCategoryCreated,
}: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState(3)
  const [categoryId, setCategoryId] = useState('')
  const [syncWithGoogle, setSyncWithGoogle] = useState(false)
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null)
  const [intentionWhen, setIntentionWhen] = useState('')
  const [intentionWhere, setIntentionWhere] = useState('')
  const [intentionOpen, setIntentionOpen] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  const [isImportant, setIsImportant] = useState(false)
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null)

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState('')

  // Ad-hoc AI fill
  const [adHocText, setAdHocText] = useState('')
  const [adHocLoading, setAdHocLoading] = useState(false)
  const [adHocError, setAdHocError] = useState('')

  // Nowa kategoria — inline form
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#3b82f6')
  const [newCatLoading, setNewCatLoading] = useState(false)

  const isEditing = !!task

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setDeadline(toDatetimeLocal(task.deadline))
      setPriority(task.priority)
      setCategoryId(task.categoryId)
      setSyncWithGoogle(task.syncWithGoogle)
      setRecurrence(task.recurrence ?? 'none')
      setRecurrenceEnd(task.recurrenceEnd ? task.recurrenceEnd.toISOString().slice(0, 10) : '')
      setSubtasks(task.subtasks ?? [])
      setEstimatedMinutes(task.estimatedMinutes ?? null)
      setIntentionWhen(task.intentionWhen ?? '')
      setIntentionWhere(task.intentionWhere ?? '')
      setIntentionOpen(!!task.intentionWhen || !!task.intentionWhere)
      setIsUrgent(task.isUrgent ?? false)
      setIsImportant(task.isImportant ?? false)
      setEnergyLevel(task.energyLevel ?? null)
    } else {
      setTitle('')
      setDescription('')
      setDeadline('')
      setPriority(3)
      setCategoryId('')
      setSyncWithGoogle(false)
      setRecurrence('none')
      setRecurrenceEnd('')
      setSubtasks([])
      setEstimatedMinutes(null)
      setIntentionWhen('')
      setIntentionWhere('')
      setIntentionOpen(false)
      setIsUrgent(false)
      setIsImportant(true)
      setEnergyLevel(null)
    }
    setNewSubtaskText('')
    setAdHocText('')
    setAdHocError('')
    setShowNewCategory(false)
    setNewCatName('')
    setNewCatColor('#3b82f6')
  }, [task, open])

  const handleAdHocFill = async () => {
    if (!adHocText.trim()) return
    setAdHocLoading(true)
    setAdHocError('')

    try {
      const res = await fetch('/api/ai/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: adHocText, categories }),
      })

      if (!res.ok) {
        const err = await res.json()
        setAdHocError(err.error ?? 'Błąd AI')
        return
      }

      const parsed = await res.json()
      if (parsed.title) setTitle(parsed.title)
      if (parsed.description) setDescription(parsed.description)
      if (parsed.deadline) setDeadline(parsed.deadline)
      if (parsed.priority) setPriority(parsed.priority)
      const validCategory = parsed.categoryId && categories.some((c) => c.id === parsed.categoryId)
      if (validCategory) {
        setCategoryId(parsed.categoryId)
      } else if (parsed.suggestedCategoryName) {
        setShowNewCategory(true)
        setNewCatName(parsed.suggestedCategoryName)
      }
    } catch {
      setAdHocError('Nie udało się połączyć z AI')
    } finally {
      setAdHocLoading(false)
    }
  }

  const handleCategoryChange = (value: string) => {
    if (value === '__new__') {
      setShowNewCategory(true)
      setCategoryId('')
    } else {
      setShowNewCategory(false)
      setCategoryId(value)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    setNewCatLoading(true)

    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    })

    setNewCatLoading(false)

    if (res.ok) {
      const created: Category = await res.json()
      onCategoryCreated?.(created)
      setCategoryId(created.id)
      setShowNewCategory(false)
      setNewCatName('')
      setNewCatColor('#3b82f6')
    }
  }

  const addSubtask = () => {
    if (!newSubtaskText.trim()) return
    setSubtasks((prev) => [...prev, { id: nanoid(), text: newSubtaskText.trim(), done: false }])
    setNewSubtaskText('')
  }

  const toggleSubtask = (id: string) =>
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s))

  const removeSubtask = (id: string) =>
    setSubtasks((prev) => prev.filter((s) => s.id !== id))

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      deadline: deadline ? new Date(deadline) : new Date(),
      priority,
      categoryId,
      syncWithGoogle,
      completed: task?.completed || false,
      recurrence,
      recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      estimatedMinutes: estimatedMinutes ?? undefined,
      intentionWhen: intentionWhen.trim() || null,
      intentionWhere: intentionWhere.trim() || null,
      isUrgent,
      isImportant,
      energyLevel,
    })
    onOpenChange(false)
  }

  const selectedCategory = categories.find((c) => c.id === categoryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edytuj zadanie' : 'Dodaj zadanie'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Ad-hoc AI fill — only when creating */}
          {!isEditing && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                Opisz zadanie po ludzku
              </div>
              <Textarea
                value={adHocText}
                onChange={(e) => setAdHocText(e.target.value)}
                placeholder="np. &quot;ogarnij cieknący kran do piątku bo rodzice przyjeżdżają&quot;"
                rows={2}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleAdHocFill()
                  }
                }}
              />
              {adHocError && (
                <p className="text-xs text-destructive">{adHocError}</p>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleAdHocFill}
                disabled={!adHocText.trim() || adHocLoading}
                className="w-full gap-1.5"
              >
                {adHocLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI uzupełnia pola…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Uzupełnij z AI
                    <span className="text-xs opacity-60 ml-1">Ctrl+Enter</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł zadania *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wpisz tytuł zadania..."
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalny opis..."
              rows={3}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">Termin</Label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: 'Dziś', days: 0 },
                { label: 'Jutro', days: 1 },
                { label: 'Za 3 dni', days: 3 },
                { label: 'Za tydzień', days: 7 },
              ].map(({ label, days }) => {
                const d = new Date()
                d.setDate(d.getDate() + days)
                d.setHours(23, 59, 0, 0)
                const val = toDatetimeLocal(d)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDeadline(val)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs border transition-colors',
                      deadline === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priorytet</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={priority === level ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPriority(level)}
                  className={cn('w-10 h-10', priority === level && 'bg-primary text-primary-foreground')}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          {/* Eisenhower Matrix */}
          <div className="space-y-2">
            <Label>Matriks Eisenhowera</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'Q1', urgent: true,  important: true,  label: 'Q1 · Zrób teraz',   color: 'bg-destructive/10 border-destructive/40 text-destructive' },
                { key: 'Q2', urgent: false, important: true,  label: 'Q2 · Zaplanuj',      color: 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400' },
                { key: 'Q3', urgent: true,  important: false, label: 'Q3 · Deleguj',       color: 'bg-orange-500/10 border-orange-500/40 text-orange-700 dark:text-orange-400' },
                { key: 'Q4', urgent: false, important: false, label: 'Q4 · Usuń',          color: 'bg-muted/60 border-border text-muted-foreground' },
              ].map(({ key, urgent, important, label, color }) => {
                const active = isUrgent === urgent && isImportant === important
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setIsUrgent(urgent); setIsImportant(important) }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium text-left transition-all',
                      active ? color + ' ring-1 ring-inset ring-current' : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    <span className="font-bold">{label.split(' · ')[0]}</span>
                    <span className="ml-1 font-normal opacity-80">{label.split(' · ')[1]}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className={cn('flex items-center gap-1', isUrgent && 'text-destructive font-medium')}>
                <Zap className="w-3 h-3" /> {isUrgent ? 'Pilne' : 'Niepilne'}
              </span>
              <span className={cn('flex items-center gap-1', isImportant && 'text-green-600 dark:text-green-400 font-medium')}>
                <Brain className="w-3 h-3" /> {isImportant ? 'Ważne' : 'Nieważne'}
              </span>
            </div>
          </div>

          {/* Energy level */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5" />
              Poziom energii
            </Label>
            <div className="flex gap-1.5">
              {([
                { value: 'high', label: '🧠 Wysoka', desc: 'Głębokie myślenie' },
                { value: 'low',  label: '🌿 Niska',  desc: 'Mechaniczne zadania' },
                { value: 'any',  label: '⚡ Dowolna', desc: '' },
              ] as { value: EnergyLevel; label: string; desc: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEnergyLevel(energyLevel === value ? null : value)}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-md text-xs border transition-colors',
                    energyLevel === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategoria</Label>
            <Select
              value={showNewCategory ? '__new__' : categoryId}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię">
                  {selectedCategory && !showNewCategory && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      {selectedCategory.name}
                    </div>
                  )}
                  {showNewCategory && (
                    <span className="text-muted-foreground">Nowa kategoria…</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="w-3 h-3" />
                    Dodaj nową kategorię
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Inline new category form */}
            {showNewCategory && (
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                <Input
                  placeholder="Nazwa kategorii..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  autoFocus
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kolor</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatColor(color)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: newCatColor === color ? 'white' : 'transparent',
                          outline: newCatColor === color ? `2px solid ${color}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={!newCatName.trim() || newCatLoading}
                    className="flex-1"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    {newCatLoading ? 'Tworzenie…' : 'Utwórz'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowNewCategory(false); setCategoryId('') }}
                  >
                    Anuluj
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Estimated time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              Szacowany czas
            </Label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: '⚡ 2 min', value: 2 },
                { label: '15 min', value: 15 },
                { label: '30 min', value: 30 },
                { label: '1 godz', value: 60 },
                { label: '2 godz', value: 120 },
                { label: '3+ godz', value: 180 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEstimatedMinutes(estimatedMinutes === value ? null : value)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs border transition-colors',
                    estimatedMinutes === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Implementation Intentions (Gollwitzer 1999) */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setIntentionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Kiedy i gdzie to zrobię?
                <span className="text-xs text-muted-foreground font-normal">opcjonalnie</span>
              </span>
              {intentionOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>

            {intentionOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
                <p className="text-[10px] text-muted-foreground pt-2">
                  Konkretny plan "kiedy i gdzie" zwiększa szansę realizacji o ~65% (Gollwitzer, 1999).
                </p>
                <Input
                  placeholder="Kiedy? np. jutro o 16:00, w środę rano..."
                  value={intentionWhen}
                  onChange={(e) => setIntentionWhen(e.target.value)}
                  className="text-sm h-8"
                  maxLength={200}
                />
                <Input
                  placeholder="Gdzie? np. w bibliotece, przy biurku, w kawiarni..."
                  value={intentionWhere}
                  onChange={(e) => setIntentionWhere(e.target.value)}
                  className="text-sm h-8"
                  maxLength={200}
                />
              </div>
            )}
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <RepeatIcon className="w-3.5 h-3.5" />
              Powtarzanie
            </Label>
            <div className="flex gap-1.5 flex-wrap">
              {(['none', 'daily', 'weekly', 'monthly'] as Recurrence[]).map((r) => {
                const labels: Record<Recurrence, string> = { none: 'Brak', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' }
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecurrence(r)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs border transition-colors',
                      recurrence === r
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    )}
                  >
                    {labels[r]}
                  </button>
                )
              })}
            </div>
            {recurrence !== 'none' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Label htmlFor="recurrenceEnd" className="shrink-0 text-xs">do:</Label>
                <Input
                  id="recurrenceEnd"
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="bez końca"
                />
                {recurrenceEnd && (
                  <button onClick={() => setRecurrenceEnd('')} className="text-xs text-muted-foreground hover:text-destructive">
                    wyczyść
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label>Podzadania</Label>
            {subtasks.length > 0 && (
              <div className="space-y-1 rounded-lg border border-border p-2">
                {subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => toggleSubtask(s.id)}
                      className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                    />
                    <span className={cn('flex-1 text-sm', s.done && 'line-through text-muted-foreground')}>
                      {s.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                placeholder="Dodaj podzadanie…"
                className="text-sm h-8"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              />
              <Button type="button" size="sm" variant="outline" onClick={addSubtask} disabled={!newSubtaskText.trim()} className="shrink-0 h-8">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Sync with Google Calendar */}
          <div className="flex items-center justify-between">
            <Label htmlFor="sync" className="cursor-pointer">
              Synchronizuj z Google Calendar
            </Label>
            <Switch
              id="sync"
              checked={syncWithGoogle}
              onCheckedChange={setSyncWithGoogle}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="bg-primary text-primary-foreground"
          >
            {isEditing ? 'Zapisz zmiany' : 'Dodaj zadanie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
