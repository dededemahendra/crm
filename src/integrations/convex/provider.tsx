// Convex is now provided via ConvexBetterAuthProvider in src/routes/__root.tsx
// This file is kept for compatibility with any remaining imports.

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
