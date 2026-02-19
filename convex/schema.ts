import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    betterAuthId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal('admin'),
      v.literal('manager'),
      v.literal('viewer'),
    ),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_better_auth_id', ['betterAuthId']),

  products: defineTable({
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    unitCost: v.number(),
    qty: v.number(),
    reorderLevel: v.number(),
    updatedAt: v.number(),
  }).index('by_category', ['category']),

  purchases: defineTable({
    productId: v.id('products'),
    qty: v.number(),
    unitCost: v.number(),
    totalCost: v.number(),
    supplier: v.string(),
    invoiceNo: v.optional(v.string()),
    date: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_date', ['date']),

  sales: defineTable({
    productId: v.id('products'),
    qty: v.number(),
    sellingPrice: v.number(),
    discount: v.number(),
    cogs: v.number(),
    revenue: v.number(),
    date: v.number(),
    voided: v.optional(v.boolean()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_date', ['date']),

  operatingExpenses: defineTable({
    category: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_date', ['date']),

  otherIncome: defineTable({
    source: v.string(),
    amount: v.number(),
    notes: v.optional(v.string()),
    date: v.number(),
    createdAt: v.number(),
  }).index('by_date', ['date']),

  appSettings: defineTable({
    taxRate: v.number(), // percentage, e.g. 11 for 11%
    expenseCategories: v.array(v.string()),
  }),
})
