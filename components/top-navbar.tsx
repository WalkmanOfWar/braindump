'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PushSubscribeButton } from '@/components/push-subscribe'
import { LayoutDashboard, CheckSquare, GraduationCap, Calendar, LogOut, Sun, Moon, BarChart2, Search, Brain, TrendingUp } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/today', label: 'Dziś', icon: Sun },
  { href: '/tasks', label: 'Zadania', icon: CheckSquare },
  { href: '/exams', label: 'Egzaminy', icon: GraduationCap },
  { href: '/calendar', label: 'Kalendarz', icon: Calendar },
  { href: '/braindump', label: 'Notatnik', icon: Brain },
  { href: '/review', label: 'Przegląd', icon: TrendingUp },
  { href: '/stats', label: 'Statystyki', icon: BarChart2 },
]

function openPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

export function TopNavbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Brain Dump</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="flex items-center gap-1">
          {/* Cmd+K search trigger — dispatches the synthetic event that CommandPalette listens for */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-2 text-xs rounded-md border border-border/50"
            onClick={openPalette}
            title="Szybkie wyszukiwanie"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Szukaj</span>
            <kbd className="ml-1 pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-border bg-muted px-1 font-mono text-[10px] opacity-70">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={openPalette}
            title="Szukaj"
          >
            <Search className="h-4 w-4" />
          </Button>
          <PushSubscribeButton />

          {/* Theme toggle — only render after mount to avoid hydration mismatch */}
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title={resolvedTheme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          <Avatar className="h-8 w-8 ml-1">
            <AvatarImage
              src={session?.user?.image ?? undefined}
              alt={session?.user?.name ?? 'Avatar'}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Wyloguj</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
