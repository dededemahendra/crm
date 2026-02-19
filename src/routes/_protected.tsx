import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useMutation, Authenticated } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { useSession } from '@/lib/auth-client'
import { AppSidebar } from '@/components/app-sidebar'

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
})

/** Runs provisionMe only after Convex confirms the JWT is set */
function ProvisionUser({ name, email }: { name: string; email: string }) {
  const provisionMe = useMutation(api.users.provisionMe)

  useEffect(() => {
    provisionMe({ name, email }).catch((e: unknown) => {
      toast.error(`Account setup failed: ${String(e)}`)
      console.error('provisionMe error:', e)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function ProtectedLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !session) {
      void navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])

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
      <Authenticated>
        <ProvisionUser name={session.user.name} email={session.user.email} />
      </Authenticated>
      <AppSidebar />
      <main className="md:pl-60 print:pl-0">
        <Outlet />
      </main>
    </div>
  )
}
