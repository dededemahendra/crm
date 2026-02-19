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
    qty: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { id, qty }) => {
    await requireRole(ctx, ['admin', 'manager'])
    if (qty < 0) throw new Error('Quantity cannot be negative')
    await ctx.db.patch(id, { qty, updatedAt: Date.now() })
  },
})
