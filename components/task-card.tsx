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
import { MoreHorizontal, Pencil, Trash2, Calendar } from 'lucide-react'
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
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (task: UiTask) => void
  onDelete?: (id: string) => void
}

export function TaskCard({
  task,
  variant = 'default',
  categoryOverride,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const category = categoryOverride ?? null
  const urgencyLevel = getUrgencyLevel(task.deadline)
  const urgencyColor = getUrgencyColor(urgencyLevel)

  const handleToggle = () => {
    const newValue = !isCompleted
    setIsCompleted(newValue)
    onToggleComplete?.(task.id, newValue)
  }

  const isHighlighted = variant === 'highlighted'

  return (
    <>
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border transition-all',
        isHighlighted
          ? 'bg-primary text-primary-foreground border-primary shadow-lg'
          : 'bg-card border-border hover:border-muted-foreground/30 hover:shadow-sm'
      )}
    >
      <Checkbox 
        checked={isCompleted}
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
              <DropdownMenuItem>
                <Calendar className="h-4 w-4 mr-2" />
                Sync z Google Calendar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Deadline */}
          <span 
            className={cn(
              'text-xs',
              isHighlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
            style={{ color: isHighlighted ? undefined : urgencyColor }}
          >
            Termin: {formatDate(task.deadline)}
          </span>
          
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
        </div>
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

