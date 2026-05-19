'use client'

import { useState, useMemo } from 'react'
import { TopNavbar } from '@/components/top-navbar'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { 
  tasks, 
  exams, 
  categories,
  Task, 
  StudySession,
  getCategoryById,
  formatDateFull,
} from '@/lib/mock-data'

type CalendarItem = {
  type: 'task' | 'session'
  data: Task | (StudySession & { examTitle: string })
}

const DAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Get Monday of current week
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const weekStart = getWeekStart(currentDate)

  // Generate week days
  const weekDays = useMemo(() => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      days.push(day)
    }
    return days
  }, [weekStart])

  // Get items for a specific day
  const getItemsForDay = (date: Date): CalendarItem[] => {
    const items: CalendarItem[] = []
    
    // Add tasks
    tasks.forEach(task => {
      const taskDate = new Date(task.deadline)
      if (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      ) {
        items.push({ type: 'task', data: task })
      }
    })

    // Add study sessions
    exams.forEach(exam => {
      exam.sessions.forEach(session => {
        const sessionDate = new Date(session.date)
        if (
          sessionDate.getDate() === date.getDate() &&
          sessionDate.getMonth() === date.getMonth() &&
          sessionDate.getFullYear() === date.getFullYear()
        ) {
          items.push({ 
            type: 'session', 
            data: { ...session, examTitle: exam.title } 
          })
        }
      })
    })

    return items
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleItemClick = (item: CalendarItem) => {
    setSelectedItem(item)
    setSheetOpen(true)
  }

  const formatWeekRange = () => {
    const endDate = new Date(weekStart)
    endDate.setDate(weekStart.getDate() + 6)
    
    const startDay = weekStart.getDate()
    const endDay = endDate.getDate()
    const month = weekStart.toLocaleDateString('pl-PL', { month: 'long' })
    const year = weekStart.getFullYear()
    
    return `${startDay}–${endDay} ${month} ${year}`
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={goToPreviousWeek}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Poprzedni tydzień
            </Button>
            
            <span className="text-sm font-medium text-foreground px-2 hidden sm:inline">
              {formatWeekRange()}
            </span>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={goToNextWeek}
            >
              Następny tydzień
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <Button 
            variant="secondary" 
            size="sm"
            onClick={goToToday}
          >
            Dziś
          </Button>
        </div>

        {/* Mobile Week Range */}
        <p className="text-sm font-medium text-foreground mb-4 sm:hidden text-center">
          {formatWeekRange()}
        </p>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Day Headers */}
          {weekDays.map((day, index) => (
            <div 
              key={`header-${index}`}
              className={cn(
                'text-center py-2 px-1',
                isToday(day) && 'bg-accent/20 rounded-t-lg'
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {DAYS_PL[index]}
              </div>
              <div 
                className={cn(
                  'text-lg font-semibold',
                  isToday(day) ? 'text-accent-foreground' : 'text-foreground'
                )}
              >
                {day.getDate()}
              </div>
            </div>
          ))}

          {/* Day Cells */}
          {weekDays.map((day, index) => {
            const items = getItemsForDay(day)
            const todayClass = isToday(day)
            
            return (
              <div 
                key={`cell-${index}`}
                className={cn(
                  'min-h-[120px] sm:min-h-[160px] border border-border rounded-lg p-1 sm:p-2',
                  todayClass && 'bg-accent/10 border-accent/30'
                )}
              >
                <div className="space-y-1">
                  {items.slice(0, 4).map((item, itemIndex) => {
                    if (item.type === 'task') {
                      const task = item.data as Task
                      const category = getCategoryById(task.categoryId)
                      const isDeadlineToday = isToday(task.deadline)
                      
                      return (
                        <button
                          key={`task-${task.id}`}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            'w-full text-left px-1.5 py-1 rounded text-xs truncate flex items-center gap-1',
                            'hover:opacity-80 transition-opacity'
                          )}
                          style={{ 
                            backgroundColor: category ? `${category.color}30` : '#e5e5e5',
                            color: category?.color || '#1a1a1a',
                          }}
                        >
                          {isDeadlineToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </button>
                      )
                    } else {
                      const session = item.data as StudySession & { examTitle: string }
                      return (
                        <button
                          key={`session-${session.id}`}
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left px-1.5 py-1 rounded text-xs truncate bg-accent text-accent-foreground hover:opacity-80 transition-opacity"
                        >
                          {session.examTitle.replace('Egzamin z ', '').slice(0, 10)} {session.hours}h
                        </button>
                      )
                    }
                  })}
                  
                  {items.length > 4 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{items.length - 4} więcej
                    </div>
                  )}
                </div>

                {/* Add button */}
                <button 
                  className="w-full mt-1 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors flex items-center justify-center gap-1 opacity-0 hover:opacity-100"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">dodaj</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground">Legenda:</span>
          {categories.map(category => (
            <div key={category.id} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-xs text-muted-foreground">{category.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent" />
            <span className="text-xs text-muted-foreground">Sesja nauki</span>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {selectedItem?.type === 'task' ? 'Szczegóły zadania' : 'Szczegóły sesji'}
            </SheetTitle>
          </SheetHeader>
          
          {selectedItem && (
            <div className="mt-6 space-y-4">
              {selectedItem.type === 'task' ? (
                <>
                  {(() => {
                    const task = selectedItem.data as Task
                    const category = getCategoryById(task.categoryId)
                    return (
                      <>
                        <div>
                          <h3 className="font-semibold text-foreground">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Termin</span>
                            <span className="text-sm font-medium">{formatDateFull(task.deadline)}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Priorytet</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <div 
                                  key={level}
                                  className={cn(
                                    'w-2 h-2 rounded-full',
                                    level <= task.priority ? 'bg-foreground' : 'bg-border'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          
                          {category && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Kategoria</span>
                              <Badge 
                                variant="secondary"
                                style={{ 
                                  backgroundColor: `${category.color}20`,
                                  color: category.color,
                                }}
                              >
                                {category.name}
                              </Badge>
                            </div>
                          )}
                          
                          {task.tags.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Tagi</span>
                              <div className="flex gap-1 flex-wrap justify-end">
                                {task.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </>
              ) : (
                <>
                  {(() => {
                    const session = selectedItem.data as StudySession & { examTitle: string }
                    return (
                      <>
                        <div>
                          <h3 className="font-semibold text-foreground">{session.topic}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{session.examTitle}</p>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Data</span>
                            <span className="text-sm font-medium">{formatDateFull(session.date)}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Czas nauki</span>
                            <Badge className="bg-accent text-accent-foreground">
                              {session.hours}h
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <span className={cn(
                              'text-sm font-medium',
                              session.completed ? 'text-success' : 'text-muted-foreground'
                            )}>
                              {session.completed ? 'Ukończona' : 'Do zrobienia'}
                            </span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
