import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

export const listSales = query({
  args: {},
  handler: async (ctx) => {
    const sales = await ctx.db
      .query('sales')
      .withIndex('by_date')
      .order('desc')
      .collect()

    const enriched = await Promise.all(
      sales.map(async (s) => {
        const product = await ctx.db.get(s.productId)
        return {
          ...s,
          productName: product?.name ?? 'Deleted Product',
          productSku: product?.sku ?? '—',
        }
      }),
    )

    return enriched
  },
})

export const createSale = mutation({
  args: {
    productId: v.id('products'),
    qty: v.number(),
    sellingPrice: v.number(),
    discount: v.number(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ['admin', 'manager'])

    const product = await ctx.db.get(args.productId)
    if (!product) throw new Error('Product not found')
    if (product.qty < args.qty)
      throw new Error(`Insufficient stock. Available: ${product.qty} ${product.unit}`)

    const cogs = product.unitCost * args.qty
    const revenue = args.sellingPrice * args.qty - args.discount

    await ctx.db.insert('sales', {
      ...args,
      cogs,
      revenue,
      voided: false,
      createdBy: user.name,
      createdAt: Date.now(),
    })

    await ctx.db.patch(args.productId, {
      qty: product.qty - args.qty,
      updatedAt: Date.now(),
    })
  },
})

export const voidSale = mutation({
  args: { id: v.id('sales') },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ['admin', 'manager'])

    const sale = await ctx.db.get(id)
    if (!sale) throw new Error('Sale not found')
    if (sale.voided) throw new Error('Sale is already voided')

    await ctx.db.patch(id, { voided: true })

    // Restore stock
    const product = await ctx.db.get(sale.productId)
    if (product) {
      await ctx.db.patch(sale.productId, {
        qty: product.qty + sale.qty,
        updatedAt: Date.now(),
      })
    }
  },
})
