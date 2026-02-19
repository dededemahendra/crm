import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth-client'

interface RoleGuardProps {
  allowedRoles: string[]
  children: React.ReactNode
  /** Where to redirect if role check fails. Defaults to /dashboard. */
  redirectTo?: string
}

export function RoleGuard({
  allowedRoles,
  children,
  redirectTo = '/dashboard',
}: RoleGuardProps) {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  const role = (session?.user as { role?: string } | undefined)?.role

  useEffect(() => {
    if (!isPending && session && role && !allowedRoles.includes(role)) {
      void navigate({ to: redirectTo })
    }
  }, [isPending, session, role, allowedRoles, navigate, redirectTo])

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!role || !allowedRoles.includes(role)) {
    return null
  }

  return <>{children}</>
}
