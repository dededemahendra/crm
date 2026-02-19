import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

const movementType = v.union(
  v.literal('adjustment'),
  v.literal('transfer'),
  v.literal('production'),
  v.literal('waste'),
)

export const listStockMovements = query({
  args: {
    productId: v.optional(v.id('products')),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, { productId, startDate, endDate }) => {
    let movements = await ctx.db.query('stockMovements').collect()
    if (productId) {
      movements = movements.filter((m) => m.productId === productId)
    }
    if (startDate !== undefined) {
      movements = movements.filter((m) => m.date >= startDate)
    }
    if (endDate !== undefined) {
      movements = movements.filter((m) => m.date <= endDate)
    }
    return movements.sort((a, b) => b.date - a.date)
  },
})

export const createStockMovement = mutation({
  args: {
    productId: v.id('products'),
    type: movementType,
    qty: v.number(), // positive = in, negative = out
    reason: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ['admin', 'manager'])
    const product = await ctx.db.get(args.productId)
    if (!product) throw new Error('Product not found')

    const newQty = product.qty + args.qty
    if (newQty < 0) throw new Error('Insufficient stock')

    await ctx.db.patch(args.productId, { qty: newQty, updatedAt: Date.now() })

    return ctx.db.insert('stockMovements', {
      productId: args.productId,
      type: args.type,
      qty: args.qty,
      reason: args.reason,
      date: args.date,
      createdBy: user.email,
      createdAt: Date.now(),
    })
  },
})
