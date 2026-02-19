import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

export const listOpEx = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('operatingExpenses')
      .withIndex('by_date')
      .order('desc')
      .collect()
  },
})

export const createOpEx = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ['admin', 'manager'])
    return ctx.db.insert('operatingExpenses', {
      ...args,
      createdBy: user.name,
      createdAt: Date.now(),
    })
  },
})

export const updateOpEx = mutation({
  args: {
    id: v.id('operatingExpenses'),
    category: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.number(),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireRole(ctx, ['admin', 'manager'])
    await ctx.db.patch(id, fields)
  },
})

export const deleteOpEx = mutation({
  args: { id: v.id('operatingExpenses') },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ['admin', 'manager'])
    await ctx.db.delete(id)
  },
})
