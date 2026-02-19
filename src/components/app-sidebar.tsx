import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Receipt,
  CircleDollarSign,
  BarChart3,
  Users,
  CoffeeIcon,
  LogOut,
  Menu,
  Settings2,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { signOut, useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'

type Role = 'admin' | 'manager' | 'viewer'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
  {
    label: 'Products',
    to: '/products',
    icon: Package,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
  {
    label: 'Purchases',
    to: '/purchases',
    icon: ShoppingCart,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    label: 'Sales',
    to: '/sales',
    icon: TrendingUp,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    label: 'Expenses',
    to: '/expenses',
    icon: Receipt,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    label: 'Other Income',
    to: '/income',
    icon: CircleDollarSign,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
] as const

const ADMIN_ITEMS = [
  { label: 'Settings', to: '/settings', icon: Settings2 },
] as const

const ROLE_BADGE: Record<Role, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  manager: 'secondary',
  viewer: 'outline',
}

interface SidebarContentProps {
  role: Role
  onNavClick?: () => void
}

function SidebarContent({ role, onNavClick }: SidebarContentProps) {
  const { data: session } = useSession()
  const navigate = useNavigate()

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const showAdmin = role === 'admin'

  async function handleSignOut() {
    await signOut()
    void navigate({ to: '/login' })
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <CoffeeIcon className="size-5 text-sidebar-primary" />
          <span className="font-semibold text-sm">Cafe CRM</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {visibleNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{
              className:
                'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
            }}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}

        {showAdmin && (
          <>
            <Separator className="my-2 bg-sidebar-border" />
            {ADMIN_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={onNavClick}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className:
                    'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                }}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user.name ?? '—'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {session?.user.email}
            </p>
          </div>
          <Badge variant={ROLE_BADGE[role]} className="text-xs shrink-0">
            {role}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-30 border-r border-sidebar-border">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-background border-b">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SidebarContent
              role={role}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <CoffeeIcon className="size-4" />
          <span className="font-semibold text-sm">Cafe CRM</span>
        </div>

        <ThemeToggle />
      </header>
    </>
  )
}
