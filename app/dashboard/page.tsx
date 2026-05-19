'use client'

import { useState } from 'react'
import { TopNavbar } from '@/components/top-navbar'
import { BottomNav } from '@/components/bottom-nav'
import { TaskCard } from '@/components/task-card'
import { Badge } from '@/components/ui/badge'
import { 
  tasks, 
  exams,
  getTop3Tasks, 
  getTodaySessions,
  getCategoryById,
  Task
} from '@/lib/mock-data'

export default function DashboardPage() {
  const [allTasks, setAllTasks] = useState<Task[]>(tasks)
  const top3Tasks = getTop3Tasks()
  const todaySessions = getTodaySessions()

  const handleToggleComplete = (id: string, completed: boolean) => {
    setAllTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, completed } : task
      )
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />
      
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Top 3 Tasks Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Dziś zacznij od tego
          </h2>
          <div className="space-y-3">
            {top3Tasks.map((task, index) => (
              <TaskCard 
                key={task.id}
                task={task}
                variant={index === 0 ? 'highlighted' : 'default'}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </section>

        {/* Today's Study Sessions */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Sesje nauki na dziś
          </h2>
          {todaySessions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {todaySessions.map((session) => {
                const exam = exams.find(e => e.id === session.examId)
                return (
                  <div 
                    key={session.id}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full shrink-0 border border-border"
                  >
                    <span className="text-sm font-medium text-foreground whitespace-nowrap">
                      {exam?.title.replace('Egzamin z ', '').replace('Certyfikat ', '')}
                    </span>
                    <Badge 
                      className="bg-accent text-accent-foreground hover:bg-accent/90 px-2 py-0.5 text-xs"
                    >
                      {session.hours}h
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Brak sesji nauki na dziś
            </p>
          )}
        </section>

        {/* All Tasks Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Wszystkie zadania
          </h2>
          <div className="space-y-2">
            {allTasks.map((task) => (
              <TaskCard 
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
