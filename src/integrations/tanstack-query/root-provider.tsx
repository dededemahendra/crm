// QueryClient and ConvexQueryClient are created in src/router.tsx
// and provided to the app via __root.tsx using route context.
// This file is kept for compatibility with any existing imports.

export function getContext() {
  return {}
}

export default function TanStackQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
