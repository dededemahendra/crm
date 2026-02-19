import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authComponent } from './auth'
import { requireRole } from './lib/auth'

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx)
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
