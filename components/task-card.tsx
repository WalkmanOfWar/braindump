'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { MoreHorizontal, Pencil, Trash2, CalendarPlus, CalendarX2, Loader2, AlertTriangle, Repeat, Zap, MapPin, Timer, Brain, Battery, SkipForward } from 'lucide-react'
import type { UiTask } from '@/types'
import { getUrgencyLevel, getUrgencyColor, formatDate } from '@/lib/utils'
interface CategoryInfo {
  name: string
  color: string
}

interface TaskCardProps {
  task: UiTask
  variant?: 'default' | 'highlighted'
  categoryOverride?: CategoryInfo | null
  onToggleComplete?: (id: string, completed: boolean, actualMinutes?: number) => void
  onEdit?: (task: UiTask) => void
  onDelete?: (id: string) => void
  onSyncCalendar?: (id: string, action: 'create' | 'delete') => Promise<void>
  onSkipOccurrence?: (id: string) => void
  selectionMode?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
  weeklyMatch?: boolean
}

export function TaskCard({
  task,
  variant = 'default',
  categoryOverride,
  onToggleComplete,
  onEdit,
  onDelete,
  onSyncCalendar,
  onSkipOccurrence,
  selectionMode = false,
  selected = false,
  onSelect,
  weeklyMatch = false,
}: TaskCardProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showActualTime, setShowActualTime] = useState(false)
  const [actualMinutesInput, setActualMinutesInput] = useState('')
  const category = categoryOverride ?? null
  const urgencyLevel = getUrgencyLevel(task.deadline)
  const urgencyColor = getUrgencyColor(urgencyLevel)
  const isOverdue = !isCompleted && task.deadline < new Date()

  const [justCompleted, setJustCompleted] = useState(false)

  const handleToggle = () => {
    if (selectionMode) {
      onSelect?.(task.id)
      return
    }
    const newValue = !isCompleted
    setIsCompleted(newValue)
    if (newValue) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 600)
      // If task had an estimate, ask for actual time (Planning Fallacy tracking)
      if (task.estimatedMinutes) {
        setActualMinutesInput('')
        setShowActualTime(true)
      } else {
        onToggleComplete?.(task.id, true)
      }
    } else {
      onToggleComplete?.(task.id, false)
    }
  }

  const handleActualTimeSubmit = (skip = false) => {
    const actual = skip ? undefined : parseInt(actualMinutesInput, 10) || undefined
    onToggleComplete?.(task.id, true, actual)
    setShowActualTime(false)
  }

  const isHighlighted = variant === 'highlighted'

  return (
    <>
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border transition-all duration-300',
        justCompleted && 'ring-2 ring-urgency-low/60 scale-[0.98]',
        isHighlighted
          ? 'bg-primary text-primary-foreground border-primary shadow-lg'
          : selected
            ? 'bg-primary/5 border-primary ring-1 ring-primary/40'
            : isOverdue
              ? 'bg-destructive/5 border-destructive/40 border-l-4 border-l-destructive hover:shadow-sm'
              : 'bg-card border-border hover:border-muted-foreground/30 hover:shadow-sm'
      )}
    >
      <Checkbox
        checked={selectionMode ? selected : isCompleted}
        onCheckedChange={handleToggle}
        className={cn(
          'mt-0.5',
          isHighlighted && 'border-primary-foreground data-[state=checked]:bg-accent data-[state=checked]:border-accent'
        )}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 
            className={cn(
              'font-medium text-sm leading-tight',
              isCompleted && 'line-through opacity-60'
            )}
          >
            {task.title}
          </h3>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  'h-6 w-6 p-0 shrink-0',
                  isHighlighted && 'text-primary-foreground hover:bg-primary-foreground/10'
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(task)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edytuj
              </DropdownMenuItem>
              {task.recurrence !== "none" && onSkipOccurrence && !task.completed && (
                <DropdownMenuItem onClick={() => onSkipOccurrence(task.id)} className="text-muted-foreground">
                  <SkipForward className="h-4 w-4 mr-2" />
                  Pomiń tę instancję
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Usuń
              </DropdownMenuItem>
              {onSyncCalendar && (
                <DropdownMenuItem
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true)
                    await onSyncCalendar(task.id, task.syncWithGoogle ? 'delete' : 'create')
                    setSyncing(false)
                  }}
                >
                  {syncing
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : task.syncWithGoogle
                      ? <CalendarX2 className="h-4 w-4 mr-2 text-destructive" />
                      : <CalendarPlus className="h-4 w-4 mr-2" />
                  }
                  {task.syncWithGoogle ? 'Usuń z Google Calendar' : 'Dodaj do Google Calendar'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Deadline */}
          {isOverdue && !isHighlighted ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Po terminie · {formatDate(task.deadline)}
            </span>
          ) : (
            <span
              className={cn(
                'text-xs',
                isHighlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
              style={{ color: isHighlighted ? undefined : urgencyColor }}
            >
              Termin: {formatDate(task.deadline)}
            </span>
          )}
          
          {/* Category Badge */}
          {category && (
            <Badge 
              variant="secondary"
              className="text-xs px-2 py-0.5"
              style={{ 
                backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : `${category.color}20`,
                color: isHighlighted ? 'white' : category.color,
              }}
            >
              {category.name}
            </Badge>
          )}
          
          {/* Urgency Dot */}
          <div 
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: urgencyColor }}
            title={`Pilność: ${urgencyLevel}`}
          />
          
          {/* Priority Dots */}
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  level <= task.priority
                    ? isHighlighted ? 'bg-primary-foreground' : 'bg-foreground'
                    : isHighlighted ? 'bg-primary-foreground/25' : 'bg-border'
                )}
              />
            ))}
          </div>

          {/* Eisenhower quadrant badge */}
          {(task.isUrgent || task.isImportant) && (() => {
            const q = task.isUrgent && task.isImportant ? { label: 'Q1', cls: 'text-destructive bg-destructive/10' }
              : !task.isUrgent && task.isImportant ? { label: 'Q2', cls: 'text-green-700 dark:text-green-400 bg-green-500/10' }
              : task.isUrgent && !task.isImportant ? { label: 'Q3', cls: 'text-orange-700 dark:text-orange-400 bg-orange-500/10' }
              : { label: 'Q4', cls: 'text-muted-foreground bg-muted' }
            return (
              <span className={cn('inline-flex items-center text-xs font-bold rounded px-1.5 py-0.5', q.cls)}>
                {q.label}
              </span>
            )
          })()}

          {/* Energy level badge */}
          {task.energyLevel && task.energyLevel !== 'any' && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              {task.energyLevel === 'high' ? <Brain className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
              {task.energyLevel === 'high' ? 'wysoka' : 'niska'}
            </span>
          )}

          {/* Weekly plan match badge */}
          {weeklyMatch && !isCompleted && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5",
              isHighlighted ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            )} title="Pasuje do priorytetu tygodnia">
              ⭐ Plan
            </span>
          )}

          {/* Recurrence badge */}
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Repeat className="w-3 h-3" />
              {task.recurrence === 'daily' ? 'dziennie' : task.recurrence === 'weekly' ? 'tygodniowo' : 'miesięcznie'}
            </span>
          )}

          {/* 2-minute rule badge */}
          {task.estimatedMinutes != null && task.estimatedMinutes <= 2 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">
              <Zap className="w-3 h-3" />
              2 min
            </span>
          )}

        </div>

        {/* Implementation intention */}
        {(task.intentionWhen || task.intentionWhere) && (
          <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {[task.intentionWhen, task.intentionWhere].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Subtask progress */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className={cn(
                'text-xs',
                isHighlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} podzadań
              </span>
            </div>
            <div className={cn(
              'w-full rounded-full h-1 overflow-hidden',
              isHighlighted ? 'bg-primary-foreground/20' : 'bg-muted'
            )}>
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isHighlighted ? 'bg-primary-foreground' : 'bg-primary'
                )}
                style={{
                  width: `${(task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zadanie?</AlertDialogTitle>
            <AlertDialogDescription>
              „{task.title}" zostanie trwale usunięte. Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete?.(task.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Planning Fallacy: actual time dialog */}
      <Dialog open={showActualTime} onOpenChange={(o) => { if (!o) handleActualTimeSubmit(true) }}>
        <DialogContent className="sm:max-w-[340px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Ile to zajęło?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {task.estimatedMinutes && (
              <p className="text-xs text-muted-foreground">
                Szacowałeś <span className="font-medium">{task.estimatedMinutes} min</span>. Ile faktycznie?
              </p>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActualMinutesInput(String(m))}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs border transition-colors',
                    actualMinutesInput === String(m)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {m < 60 ? `${m} min` : `${m / 60} godz`}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              placeholder="Wpisz minuty..."
              value={actualMinutesInput}
              onChange={(e) => setActualMinutesInput(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleActualTimeSubmit(true)}>
              Pomiń
            </Button>
            <Button size="sm" onClick={() => handleActualTimeSubmit(false)} disabled={!actualMinutesInput}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

