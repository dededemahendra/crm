import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authComponent } from './auth'
import { requireRole } from './lib/auth'

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    // ctx.auth.getUserIdentity() returns null (never throws) when no JWT is present.
    // This prevents calling getAuthUser when there's no token at all.
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    // getAuthUser can still throw ConvexError("Unauthenticated") when the
    // Better Auth session is revoked even though the JWT hasn't expired yet.
    let authUser
    try {
      authUser = await authComponent.getAuthUser(ctx)
    } catch {
      return null
    }
    if (!authUser) return null

    return ctx.db
      .query('users')
      .withIndex('by_better_auth_id', (q) =>
        q.eq('betterAuthId', authUser._id),
      )
      .first()
  },
})

/**
 * Idempotent mutation called after login/register to ensure the user
 * has a record in our `users` table with a role.
 * New users get the `viewer` role by default.
 */
export const provisionMe = mutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { name, email }) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) throw new Error('Unauthenticated')

    const existing = await ctx.db
      .query('users')
      .withIndex('by_better_auth_id', (q) =>
        q.eq('betterAuthId', authUser._id),
      )
      .first()

    if (existing) return existing._id

    return await ctx.db.insert('users', {
      betterAuthId: authUser._id,
      email,
      name,
      role: 'viewer',
      createdAt: Date.now(),
    })
  },
})

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ['admin'])
    return ctx.db.query('users').order('asc').collect()
  },
})

/**
 * One-time bootstrap: promotes a user to admin by email.
 * Only works when there are NO admins yet.
 * Run from Convex dashboard → Functions → users:bootstrapAdmin
 * Args: { "email": "you@example.com" }
 */
export const bootstrapAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const adminExists = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .first()
    if (adminExists) throw new Error('An admin already exists')

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
    if (!user) throw new Error(`No user found with email: ${email}`)

    await ctx.db.patch(user._id, { role: 'admin' })
    return user._id
  },
})

export const updateUserRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(
      v.literal('admin'),
      v.literal('manager'),
      v.literal('viewer'),
    ),
  },
  handler: async (ctx, { userId, role }) => {
    const me = await requireRole(ctx, ['admin'])
    if (me._id === userId) throw new Error("You can't change your own role")
    await ctx.db.patch(userId, { role })
  },
})
