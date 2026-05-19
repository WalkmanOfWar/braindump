// Mock data for TaskApp

export type Category = {
  id: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  description?: string
  deadline: Date
  priority: number // 1-5
  categoryId: string
  tags: string[]
  completed: boolean
  syncWithGoogle: boolean
}

export type Exam = {
  id: string
  title: string
  examDate: Date
  hoursPerDay: number
  categoryId: string
  sessions: StudySession[]
}

export type StudySession = {
  id: string
  examId: string
  date: Date
  topic: string
  hours: number
  completed: boolean
}

export const categories: Category[] = [
  { id: 'praca', name: 'Praca', color: '#60a5fa' },
  { id: 'nauka', name: 'Nauka', color: '#ffd43b' },
  { id: 'dom', name: 'Dom', color: '#f9a8d4' },
  { id: 'zdrowie', name: 'Zdrowie', color: '#6ee7b7' },
  { id: 'osobiste', name: 'Osobiste', color: '#a5b4fc' },
]

const today = new Date()
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const in3Days = new Date(today)
in3Days.setDate(in3Days.getDate() + 3)
const in5Days = new Date(today)
in5Days.setDate(in5Days.getDate() + 5)
const in7Days = new Date(today)
in7Days.setDate(in7Days.getDate() + 7)
const in10Days = new Date(today)
in10Days.setDate(in10Days.getDate() + 10)
const in14Days = new Date(today)
in14Days.setDate(in14Days.getDate() + 14)

export const tasks: Task[] = [
  {
    id: '1',
    title: 'Przygotować prezentację na spotkanie',
    description: 'Prezentacja Q2 wyników dla zarządu',
    deadline: tomorrow,
    priority: 5,
    categoryId: 'praca',
    tags: ['prezentacja', 'pilne'],
    completed: false,
    syncWithGoogle: true,
  },
  {
    id: '2',
    title: 'Powtórzyć materiał z algebry',
    description: 'Rozdziały 4-6, szczególnie macierze',
    deadline: in3Days,
    priority: 4,
    categoryId: 'nauka',
    tags: ['egzamin', 'matematyka'],
    completed: false,
    syncWithGoogle: false,
  },
  {
    id: '3',
    title: 'Wizyta u dentysty',
    description: 'Kontrola półroczna',
    deadline: in5Days,
    priority: 3,
    categoryId: 'zdrowie',
    tags: ['lekarz'],
    completed: false,
    syncWithGoogle: true,
  },
  {
    id: '4',
    title: 'Opłacić rachunki',
    description: 'Prąd, gaz, internet',
    deadline: in7Days,
    priority: 4,
    categoryId: 'dom',
    tags: ['finanse'],
    completed: false,
    syncWithGoogle: false,
  },
  {
    id: '5',
    title: 'Zadzwonić do mamy',
    deadline: in10Days,
    priority: 2,
    categoryId: 'osobiste',
    tags: ['rodzina'],
    completed: false,
    syncWithGoogle: false,
  },
  {
    id: '6',
    title: 'Dokończyć raport miesięczny',
    description: 'Raport sprzedaży za kwiecień',
    deadline: in3Days,
    priority: 5,
    categoryId: 'praca',
    tags: ['raport', 'pilne'],
    completed: true,
    syncWithGoogle: true,
  },
  {
    id: '7',
    title: 'Posprzątać garaż',
    deadline: in14Days,
    priority: 1,
    categoryId: 'dom',
    tags: ['porządki'],
    completed: false,
    syncWithGoogle: false,
  },
]

// Generate study sessions for exams
const generateSessions = (examId: string, examDate: Date, hoursPerDay: number, topics: string[]): StudySession[] => {
  const sessions: StudySession[] = []
  const startDate = new Date()
  const daysUntilExam = Math.ceil((examDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  for (let i = 0; i < Math.min(daysUntilExam, topics.length); i++) {
    const sessionDate = new Date(startDate)
    sessionDate.setDate(sessionDate.getDate() + i)
    
    sessions.push({
      id: `${examId}-session-${i}`,
      examId,
      date: sessionDate,
      topic: topics[i % topics.length],
      hours: hoursPerDay,
      completed: i < 2, // First 2 sessions completed
    })
  }
  
  return sessions
}

export const exams: Exam[] = [
  {
    id: 'exam-1',
    title: 'Egzamin z Matematyki',
    examDate: in14Days,
    hoursPerDay: 2,
    categoryId: 'nauka',
    sessions: generateSessions('exam-1', in14Days, 2, [
      'Pochodne i całki',
      'Macierze i wyznaczniki',
      'Równania różniczkowe',
      'Szeregi liczbowe',
      'Granice funkcji',
      'Powtórka ogólna',
    ]),
  },
  {
    id: 'exam-2',
    title: 'Egzamin z Programowania',
    examDate: in10Days,
    hoursPerDay: 1.5,
    categoryId: 'nauka',
    sessions: generateSessions('exam-2', in10Days, 1.5, [
      'Algorytmy sortowania',
      'Struktury danych',
      'Programowanie obiektowe',
      'Wzorce projektowe',
      'Powtórka',
    ]),
  },
  {
    id: 'exam-3',
    title: 'Certyfikat AWS',
    examDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
    hoursPerDay: 1,
    categoryId: 'praca',
    sessions: generateSessions('exam-3', new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), 1, [
      'EC2 i VPC',
      'S3 i IAM',
      'Lambda i API Gateway',
      'DynamoDB',
    ]),
  },
]

// Helper functions
export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id)
}

export function getUrgencyLevel(deadline: Date): 'critical' | 'high' | 'medium' | 'low' {
  const now = new Date()
  const diffInDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays <= 1) return 'critical'
  if (diffInDays <= 3) return 'high'
  if (diffInDays <= 7) return 'medium'
  return 'low'
}

export function getUrgencyColor(level: 'critical' | 'high' | 'medium' | 'low'): string {
  const colors = {
    critical: '#ff6b6b',
    high: '#ffa94d',
    medium: '#ffd43b',
    low: '#69db7c',
  }
  return colors[level]
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getDaysUntil(date: Date): number {
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getTodaySessions(): StudySession[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return exams.flatMap(exam => 
    exam.sessions.filter(session => {
      const sessionDate = new Date(session.date)
      sessionDate.setHours(0, 0, 0, 0)
      return sessionDate.getTime() === today.getTime()
    })
  )
}

export function getTop3Tasks(): Task[] {
  return tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      // Sort by urgency first, then priority
      const urgencyA = getDaysUntil(a.deadline)
      const urgencyB = getDaysUntil(b.deadline)
      if (urgencyA !== urgencyB) return urgencyA - urgencyB
      return b.priority - a.priority
    })
    .slice(0, 3)
}
