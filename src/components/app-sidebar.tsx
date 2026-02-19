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
  CoffeeIcon,
  LogOut,
  Menu,
  Settings2,
  Globe,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
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
    labelKey: 'nav.dashboard' as const,
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
  {
    labelKey: 'nav.availability' as const,
    to: '/availability',
    icon: Package,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
  {
    labelKey: 'nav.purchases' as const,
    to: '/purchases',
    icon: ShoppingCart,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    labelKey: 'nav.sales' as const,
    to: '/sales',
    icon: TrendingUp,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    labelKey: 'nav.expenses' as const,
    to: '/expenses',
    icon: Receipt,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    labelKey: 'nav.income' as const,
    to: '/income',
    icon: CircleDollarSign,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    labelKey: 'nav.reports' as const,
    to: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager', 'viewer'] as Role[],
  },
]

const ADMIN_ITEMS = [
  { labelKey: 'nav.settings' as const, to: '/settings', icon: Settings2 },
]

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
  const { t, i18n } = useTranslation()

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const showAdmin = role === 'admin'

  async function handleSignOut() {
    await signOut()
    void navigate({ to: '/login' })
  }

  function toggleLanguage() {
    void i18n.changeLanguage(i18n.language === 'id' ? 'en' : 'id')
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <CoffeeIcon className="size-5 text-sidebar-primary" />
          <span className="font-semibold text-sm">Cafe CRM</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1 text-xs font-medium"
            onClick={toggleLanguage}
            title={i18n.language === 'id' ? 'Switch to English' : 'Ganti ke Indonesia'}
          >
            <Globe className="size-3.5" />
            {i18n.language === 'id' ? 'ID' : 'EN'}
          </Button>
          <ThemeToggle />
        </div>
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
            {t(item.labelKey)}
          </Link>
        ))}

        {showAdmin && (
          <>
            <Separator className="my-2 bg-sidebar-border" />
            {ADMIN_ITEMS.map((item) => (
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
                {t(item.labelKey)}
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
            {t(`roles.${role}`)}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          {t('common.signOut')}
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
      <aside className="hidden md:flex print:hidden fixed inset-y-0 left-0 w-60 flex-col z-30 border-r border-sidebar-border">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden print:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-background border-b">
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
