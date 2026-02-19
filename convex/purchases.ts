import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

export const listPurchases = query({
  args: {},
  handler: async (ctx) => {
    const purchases = await ctx.db
      .query('purchases')
      .withIndex('by_date')
      .order('desc')
      .collect()

    const enriched = await Promise.all(
      purchases.map(async (p) => {
        const product = await ctx.db.get(p.productId)
        return {
          ...p,
          productName: product?.name ?? 'Deleted Product',
          productSku: product?.sku ?? '—',
        }
      }),
    )

    return enriched
  },
})

export const createPurchase = mutation({
  args: {
    productId: v.id('products'),
    qty: v.number(),
    unitCost: v.number(),
    totalCost: v.number(),
    supplier: v.string(),
    invoiceNo: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ['admin', 'manager'])

    const product = await ctx.db.get(args.productId)
    if (!product) throw new Error('Product not found')

    await ctx.db.insert('purchases', {
      ...args,
      createdBy: user.name,
      createdAt: Date.now(),
    })

    // Update product qty and latest unit cost
    await ctx.db.patch(args.productId, {
      qty: product.qty + args.qty,
      unitCost: args.unitCost,
      updatedAt: Date.now(),
    })
  },
})
