'use client'

import { toast } from 'sonner'
import type { TaskWithCategory } from '@/types'

type SetTasks = React.Dispatch<React.SetStateAction<TaskWithCategory[]>>

export function useCalendarSync(setTasks: SetTasks) {
  const syncCalendar = async (id: string, action: 'create' | 'delete') => {
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'task', id, action }),
    })

    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, googleEventId: action === 'create' ? 'synced' : null } : t
        )
      )
      toast.success(
        action === 'create' ? 'Dodano do Google Calendar' : 'Usunięto z Google Calendar'
      )
    } else {
      const data: { error?: string } = await res.json()
      toast.error(data.error ?? 'Błąd synchronizacji')
    }
  }

  return syncCalendar
}
