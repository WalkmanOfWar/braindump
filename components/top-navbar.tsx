'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, CheckSquare, GraduationCap, Calendar, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Zadania', icon: CheckSquare },
  { href: '/exams', label: 'Egzaminy', icon: GraduationCap },
  { href: '/calendar', label: 'Kalendarz', icon: Calendar },
]

export function TopNavbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">TaskApp</span>
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
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" alt="Avatar" />
            <AvatarFallback>JK</AvatarFallback>
          </Avatar>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/login">
              <LogOut className="h-4 w-4" />
              <span>Wyloguj</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
