import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

export const listOtherIncome = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('otherIncome')
      .withIndex('by_date')
      .order('desc')
      .collect()
  },
})

export const createOtherIncome = mutation({
  args: {
    source: v.string(),
    amount: v.number(),
    notes: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin', 'manager'])
    return ctx.db.insert('otherIncome', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const updateOtherIncome = mutation({
  args: {
    id: v.id('otherIncome'),
    source: v.string(),
    amount: v.number(),
    notes: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireRole(ctx, ['admin', 'manager'])
    await ctx.db.patch(id, fields)
  },
})

export const deleteOtherIncome = mutation({
  args: { id: v.id('otherIncome') },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ['admin', 'manager'])
    await ctx.db.delete(id)
  },
})
