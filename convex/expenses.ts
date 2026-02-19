import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

const paymentMethod = v.optional(
  v.union(
    v.literal('cash'),
    v.literal('bank_transfer'),
    v.literal('credit'),
    v.literal('qris'),
  ),
)

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

export const getSupplierSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const purchases = await ctx.db.query('purchases').collect()
    const unique = [...new Set(purchases.map((p) => p.supplier).filter(Boolean))]
    return unique.sort()
  },
})

export const createOpEx = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.number(),
    supplier: v.optional(v.string()),
    paymentMethod,
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
    supplier: v.optional(v.string()),
    paymentMethod,
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
