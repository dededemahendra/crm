import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRole } from './lib/auth'

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query('products').collect()
  },
})

export const createProduct = mutation({
  args: {
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    qty: v.number(),
    reorderLevel: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin', 'manager'])
    const existing = await ctx.db
      .query('products')
      .filter((q) => q.eq(q.field('sku'), args.sku))
      .first()
    if (existing) throw new Error(`SKU "${args.sku}" is already in use`)
    return ctx.db.insert('products', { ...args, updatedAt: Date.now() })
  },
})

export const updateProduct = mutation({
  args: {
    id: v.id('products'),
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    qty: v.number(),
    reorderLevel: v.number(),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireRole(ctx, ['admin', 'manager'])
    const existing = await ctx.db
      .query('products')
      .filter((q) => q.eq(q.field('sku'), fields.sku))
      .first()
    if (existing && existing._id !== id)
      throw new Error(`SKU "${fields.sku}" is already in use`)
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const deleteProduct = mutation({
  args: { id: v.id('products') },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ['admin'])
    await ctx.db.delete(id)
  },
})

export const adjustStock = mutation({
  args: {
    id: v.id('products'),
    qty: v.number(), // new absolute quantity
    reason: v.string(),
    type: v.optional(
      v.union(
        v.literal('adjustment'),
        v.literal('transfer'),
        v.literal('production'),
        v.literal('waste'),
      ),
    ),
    date: v.optional(v.number()),
  },
  handler: async (ctx, { id, qty, reason, type, date }) => {
    const user = await requireRole(ctx, ['admin', 'manager'])
    if (qty < 0) throw new Error('Quantity cannot be negative')
    const product = await ctx.db.get(id)
    if (!product) throw new Error('Product not found')
    const delta = qty - product.qty
    await ctx.db.patch(id, { qty, updatedAt: Date.now() })
    // Log the movement if there's a change
    if (delta !== 0) {
      await ctx.db.insert('stockMovements', {
        productId: id,
        type: type ?? 'adjustment',
        qty: delta,
        reason,
        date: date ?? Date.now(),
        createdBy: user.email,
        createdAt: Date.now(),
      })
    }
  },
})

export const bulkUpsertProducts = mutation({
  args: {
    products: v.array(
      v.object({
        sku: v.string(),
        name: v.string(),
        unit: v.string(),
        qty: v.number(),
        category: v.optional(v.string()),
        reorderLevel: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { products }) => {
    await requireRole(ctx, ['admin', 'manager'])
    let created = 0
    let updated = 0
    for (const p of products) {
      const existing = await ctx.db
        .query('products')
        .filter((q) => q.eq(q.field('sku'), p.sku))
        .first()
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: p.name,
          unit: p.unit,
          qty: p.qty,
          updatedAt: Date.now(),
          ...(p.category ? { category: p.category } : {}),
          ...(p.reorderLevel !== undefined ? { reorderLevel: p.reorderLevel } : {}),
        })
        updated++
      } else {
        await ctx.db.insert('products', {
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          qty: p.qty,
          category: p.category ?? 'Uncategorized',
          reorderLevel: p.reorderLevel ?? 0,
          unitCost: 0,
          updatedAt: Date.now(),
        })
        created++
      }
    }
    return { created, updated }
  },
})

export const getStockSummary = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const products = await ctx.db.query('products').collect()
    const purchases = await ctx.db.query('purchases').collect()
    const sales = await ctx.db.query('sales').collect()
    const movements = await ctx.db.query('stockMovements').collect()

    return products.map((product) => {
      const pid = product._id

      const inRange = (date: number) => {
        if (startDate !== undefined && date < startDate) return false
        if (endDate !== undefined && date > endDate) return false
        return true
      }

      const totalPurchased = purchases
        .filter(
          (p) =>
            p.productId === pid &&
            p.status !== 'cancelled' &&
            inRange(p.date),
        )
        .reduce((s, p) => s + p.qty, 0)

      const totalSold = sales
        .filter(
          (s) => s.productId === pid && !s.voided && inRange(s.date),
        )
        .reduce((s, p) => s + p.qty, 0)

      const movementsForProduct = movements.filter(
        (m) => m.productId === pid && inRange(m.date),
      )

      const totalAdjustment = movementsForProduct
        .filter((m) => m.type === 'adjustment')
        .reduce((s, m) => s + m.qty, 0)

      const totalTransfer = movementsForProduct
        .filter((m) => m.type === 'transfer')
        .reduce((s, m) => s + m.qty, 0)

      const totalProduction = movementsForProduct
        .filter((m) => m.type === 'production')
        .reduce((s, m) => s + m.qty, 0)

      const totalWaste = movementsForProduct
        .filter((m) => m.type === 'waste')
        .reduce((s, m) => s + m.qty, 0)

      return {
        ...product,
        totalPurchased,
        totalSold,
        totalAdjustment,
        totalTransfer,
        totalProduction,
        totalWaste,
        currentQty: product.qty,
      }
    })
  },
})
