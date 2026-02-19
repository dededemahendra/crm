import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'

import type { QueryClient } from '@tanstack/react-query'
import type { ConvexQueryClient } from '@convex-dev/react-query'

import { authClient } from '@/lib/auth-client'
import { getToken } from '@/lib/auth-server'

import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Cafe CRM' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async ({ context }) => {
    const token = await getAuth()
    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token)
    }
    return { isAuthenticated: !!token, token }
  },
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })

  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <QueryClientProvider client={context.queryClient}>
        <html lang="en" suppressHydrationWarning>
          <head>
            <HeadContent />
          </head>
          <body>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Outlet />
              <Toaster richColors position="top-right" />
            </ThemeProvider>
            <Scripts />
          </body>
        </html>
      </QueryClientProvider>
    </ConvexBetterAuthProvider>
  )
}
