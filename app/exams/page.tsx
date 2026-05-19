'use client'

import { useState } from 'react'
import { TopNavbar } from '@/components/top-navbar'
import { BottomNav } from '@/components/bottom-nav'
import { ExamCard } from '@/components/exam-card'
import { ExamModal } from '@/components/exam-modal'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap } from 'lucide-react'
import { exams as initialExams, Exam, StudySession } from '@/lib/mock-data'

export default function ExamsPage() {
  const [allExams, setAllExams] = useState<Exam[]>(initialExams)
  const [modalOpen, setModalOpen] = useState(false)

  const handleToggleSession = (examId: string, sessionId: string, completed: boolean) => {
    setAllExams(prev => 
      prev.map(exam => {
        if (exam.id !== examId) return exam
        return {
          ...exam,
          sessions: exam.sessions.map(session =>
            session.id === sessionId ? { ...session, completed } : session
          )
        }
      })
    )
  }

  const handleSaveExam = (examData: Partial<Exam>) => {
    const now = new Date()
    const examDate = examData.examDate || new Date()
    const daysUntil = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    // Generate mock sessions
    const topics = [
      'Wprowadzenie i podstawy',
      'Teoria i definicje',
      'Ćwiczenia praktyczne',
      'Zagadnienia zaawansowane',
      'Powtórka całości',
    ]
    
    const sessions: StudySession[] = []
    for (let i = 0; i < Math.min(daysUntil, topics.length); i++) {
      const sessionDate = new Date(now)
      sessionDate.setDate(sessionDate.getDate() + i)
      
      sessions.push({
        id: `new-session-${Date.now()}-${i}`,
        examId: `exam-${Date.now()}`,
        date: sessionDate,
        topic: topics[i],
        hours: examData.hoursPerDay || 1,
        completed: false,
      })
    }

    const newExam: Exam = {
      id: `exam-${Date.now()}`,
      title: examData.title || 'Nowy egzamin',
      examDate: examData.examDate || new Date(),
      hoursPerDay: examData.hoursPerDay || 1,
      categoryId: examData.categoryId || 'nauka',
      sessions,
    }

    setAllExams(prev => [...prev, newExam])
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Egzaminy</h1>
          <Button 
            onClick={() => setModalOpen(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj egzamin
          </Button>
        </div>

        {/* Exam List */}
        {allExams.length > 0 ? (
          <div className="space-y-4">
            {allExams.map((exam) => (
              <ExamCard 
                key={exam.id}
                exam={exam}
                onToggleSession={handleToggleSession}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Brak egzaminów
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dodaj egzamin i wygeneruj plan nauki!
            </p>
            <Button 
              onClick={() => setModalOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj egzamin
            </Button>
          </div>
        )}
      </main>

      <BottomNav />

      <ExamModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSaveExam}
      />
    </div>
  )
}
