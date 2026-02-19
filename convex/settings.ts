import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { requireRole } from './lib/auth'

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query('appSettings').first()) ?? null
  },
})

export const upsertSettings = mutation({
  args: {
    taxRate: v.optional(v.number()),
    expenseCategories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin'])
    const existing = await ctx.db.query('appSettings').first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.taxRate !== undefined && { taxRate: args.taxRate }),
        ...(args.expenseCategories !== undefined && {
          expenseCategories: args.expenseCategories,
        }),
      })
    } else {
      await ctx.db.insert('appSettings', {
        taxRate: args.taxRate ?? 0,
        expenseCategories: args.expenseCategories ?? [],
      })
    }
  },
})
