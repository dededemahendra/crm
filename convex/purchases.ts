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
          status: p.status ?? 'active',
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
    paymentMethod,
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ['admin', 'manager'])

    const product = await ctx.db.get(args.productId)
    if (!product) throw new Error('Product not found')

    await ctx.db.insert('purchases', {
      ...args,
      status: 'active',
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

export const cancelPurchase = mutation({
  args: { id: v.id('purchases') },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ['admin', 'manager'])

    const purchase = await ctx.db.get(id)
    if (!purchase) throw new Error('Purchase not found')
    if (purchase.status === 'cancelled')
      throw new Error('Purchase is already cancelled')

    const product = await ctx.db.get(purchase.productId)
    if (product) {
      const newQty = Math.max(0, product.qty - purchase.qty)
      // Recalculate unit cost from remaining active purchases
      const remainingPurchases = await ctx.db
        .query('purchases')
        .withIndex('by_date')
        .collect()
      const otherActive = remainingPurchases.filter(
        (p) =>
          p._id !== id &&
          p.productId === purchase.productId &&
          p.status !== 'cancelled',
      )
      const lastActiveCost =
        otherActive.length > 0
          ? otherActive.sort((a, b) => b.date - a.date)[0].unitCost
          : product.unitCost

      await ctx.db.patch(purchase.productId, {
        qty: newQty,
        unitCost: lastActiveCost,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.patch(id, { status: 'cancelled' })
  },
})
