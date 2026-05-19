'use client'

import { useState } from 'react'
import { TopNavbar } from '@/components/top-navbar'
import { BottomNav } from '@/components/bottom-nav'
import { TaskCard } from '@/components/task-card'
import { TaskModal } from '@/components/task-modal'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ClipboardList } from 'lucide-react'
import { tasks as initialTasks, categories, Task } from '@/lib/mock-data'

type FilterTab = 'all' | 'active' | 'completed'
type SortOption = 'deadline' | 'priority'

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>(initialTasks)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('deadline')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Filter tasks
  const filteredTasks = allTasks
    .filter(task => {
      if (filterTab === 'active') return !task.completed
      if (filterTab === 'completed') return task.completed
      return true
    })
    .filter(task => {
      if (categoryFilter === 'all') return true
      return task.categoryId === categoryFilter
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        return a.deadline.getTime() - b.deadline.getTime()
      }
      return b.priority - a.priority
    })

  const handleToggleComplete = (id: string, completed: boolean) => {
    setAllTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, completed } : task
      )
    )
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    setAllTasks(prev => prev.filter(task => task.id !== id))
  }

  const handleSave = (taskData: Partial<Task>) => {
    if (taskData.id) {
      // Update existing task
      setAllTasks(prev => 
        prev.map(task => 
          task.id === taskData.id 
            ? { ...task, ...taskData } as Task
            : task
        )
      )
    } else {
      // Add new task
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: taskData.title || '',
        description: taskData.description,
        deadline: taskData.deadline || new Date(),
        priority: taskData.priority || 3,
        categoryId: taskData.categoryId || 'osobiste',
        tags: taskData.tags || [],
        completed: false,
        syncWithGoogle: taskData.syncWithGoogle || false,
      }
      setAllTasks(prev => [...prev, newTask])
    }
    setEditingTask(null)
  }

  const handleOpenModal = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Zadania</h1>
          <Button 
            onClick={handleOpenModal}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj zadanie
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Tabs 
            value={filterTab} 
            onValueChange={(v) => setFilterTab(v as FilterTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="all">Wszystkie</TabsTrigger>
              <TabsTrigger value="active">Aktywne</TabsTrigger>
              <TabsTrigger value="completed">Ukończone</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 flex-1 sm:flex-none">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
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
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Sortuj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Termin</SelectItem>
                <SelectItem value="priority">Priorytet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task List */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskCard 
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Brak zadań
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dodaj pierwsze zadanie!
            </p>
            <Button 
              onClick={handleOpenModal}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        )}
      </main>

      <BottomNav />

      <TaskModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        onSave={handleSave}
      />
    </div>
  )
}
