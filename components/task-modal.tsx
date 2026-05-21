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
import { Plus, Check, Sparkles, Loader2 } from 'lucide-react'
import type { UiTask, Category } from '@/types'

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
      setDeadline(task.deadline.toISOString().slice(0, 16))
      setPriority(task.priority)
      setCategoryId(task.categoryId)
      setSyncWithGoogle(task.syncWithGoogle)
    } else {
      setTitle('')
      setDescription('')
      setDeadline('')
      setPriority(3)
      setCategoryId('')
      setSyncWithGoogle(false)
    }
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
                const val = d.toISOString().slice(0, 16)
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
