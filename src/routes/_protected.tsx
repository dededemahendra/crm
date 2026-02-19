import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSession } from '@/lib/auth-client'
import { AppSidebar } from '@/components/app-sidebar'

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const provisionMe = useMutation(api.users.provisionMe)

  useEffect(() => {
    if (!isPending && !session) {
      void navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])

  useEffect(() => {
    if (session) {
      void provisionMe({
        name: session.user.name,
        email: session.user.email,
      })
    }
  }, [session, provisionMe])

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="md:pl-60 print:pl-0">
        <Outlet />
      </main>
    </div>
  )
}
