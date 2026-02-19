import { v } from 'convex/values'
import { query } from './_generated/server'

export const getPLData = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const allSales = await ctx.db
      .query('sales')
      .withIndex('by_date', (q) =>
        q.gte('date', startDate).lte('date', endDate),
      )
      .collect()

    const expenses = await ctx.db
      .query('operatingExpenses')
      .withIndex('by_date', (q) =>
        q.gte('date', startDate).lte('date', endDate),
      )
      .collect()

    const otherIncome = await ctx.db
      .query('otherIncome')
      .withIndex('by_date', (q) =>
        q.gte('date', startDate).lte('date', endDate),
      )
      .collect()

    const activeSales = allSales.filter((s) => !s.voided)

    // Enrich sales with product names
    const productIds = [...new Set(activeSales.map((s) => s.productId))]
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)))
    const productMap = new Map(
      products
        .filter(Boolean)
        .map((p) => [p!._id, { name: p!.name, sku: p!.sku }]),
    )

    return {
      sales: activeSales.map((s) => ({
        ...s,
        productName: productMap.get(s.productId)?.name ?? 'Deleted Product',
        productSku: productMap.get(s.productId)?.sku ?? '—',
      })),
      expenses,
      otherIncome,
    }
  },
})
