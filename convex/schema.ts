import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const paymentMethod = v.optional(
  v.union(
    v.literal('cash'),
    v.literal('bank_transfer'),
    v.literal('credit'),
    v.literal('qris'),
  ),
)

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
    sellingPrice: v.optional(v.number()),
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
    status: v.optional(
      v.union(v.literal('active'), v.literal('cancelled')),
    ),
    paymentMethod,
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
    supplier: v.optional(v.string()),
    date: v.number(),
    paymentMethod,
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

  stockMovements: defineTable({
    productId: v.id('products'),
    type: v.union(
      v.literal('adjustment'),
      v.literal('transfer'),
      v.literal('production'),
      v.literal('waste'),
    ),
    qty: v.number(), // positive = stock in, negative = stock out
    reason: v.optional(v.string()),
    date: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index('by_product', ['productId'])
    .index('by_date', ['date']),
})
