'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { MoreHorizontal, Pencil, Trash2, CalendarPlus, CalendarX2, Loader2, AlertTriangle, Repeat } from 'lucide-react'
import type { UiTask } from '@/types'
import { getUrgencyLevel, getUrgencyColor, formatDate } from '@/lib/utils'
import { useGoals } from '@/components/goals-provider'

interface CategoryInfo {
  name: string
  color: string
}

interface GoalInfo {
  emoji: string
  color: string
  title: string
}

interface TaskCardProps {
  task: UiTask
  variant?: 'default' | 'highlighted'
  categoryOverride?: CategoryInfo | null
  goalInfo?: GoalInfo | null
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (task: UiTask) => void
  onDelete?: (id: string) => void
  onSyncCalendar?: (id: string, action: 'create' | 'delete') => Promise<void>
  selectionMode?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

export function TaskCard({
  task,
  variant = 'default',
  categoryOverride,
  goalInfo,
  onToggleComplete,
  onEdit,
  onDelete,
  onSyncCalendar,
  selectionMode = false,
  selected = false,
  onSelect,
}: TaskCardProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const category = categoryOverride ?? null
  const { getGoalInfo } = useGoals()
  const effectiveGoalInfo = goalInfo ?? getGoalInfo(task.goalId)
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
    onToggleComplete?.(task.id, newValue)
    if (newValue) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 600)
    }
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

          {/* Recurrence badge */}
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Repeat className="w-3 h-3" />
              {task.recurrence === 'daily' ? 'dziennie' : task.recurrence === 'weekly' ? 'tygodniowo' : 'miesięcznie'}
            </span>
          )}

          {/* Goal badge */}
          {effectiveGoalInfo && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
              style={{
                backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : `${effectiveGoalInfo.color}18`,
                color: isHighlighted ? 'white' : effectiveGoalInfo.color,
              }}
              title={`Cel: ${effectiveGoalInfo.title}`}
            >
              <span>{effectiveGoalInfo.emoji}</span>
              <span className="truncate max-w-[100px]">{effectiveGoalInfo.title}</span>
            </span>
          )}
        </div>

        {/* Subtask progress */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} podzadań
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
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
    </>
  )
}

