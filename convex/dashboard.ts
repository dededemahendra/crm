import { query } from './_generated/server'

export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date()

    // Time boundaries (using local midnight)
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime()
    const todayEnd = todayStart + 86_400_000 - 1

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).getTime()

    // Parallel fetches
    const [todaySales, monthSales, allRecentSales, allRecentPurchases, allProducts] =
      await Promise.all([
        ctx.db
          .query('sales')
          .withIndex('by_date', (q) =>
            q.gte('date', todayStart).lte('date', todayEnd),
          )
          .collect(),
        ctx.db
          .query('sales')
          .withIndex('by_date', (q) =>
            q.gte('date', monthStart).lte('date', monthEnd),
          )
          .collect(),
        ctx.db
          .query('sales')
          .withIndex('by_date')
          .order('desc')
          .take(30), // overfetch to skip voided
        ctx.db
          .query('purchases')
          .withIndex('by_date')
          .order('desc')
          .take(6),
        ctx.db.query('products').collect(),
      ])

    // Compute KPIs
    const activeTodaySales = todaySales.filter((s) => !s.voided)
    const activeMonthSales = monthSales.filter((s) => !s.voided)
    const recentSales = allRecentSales.filter((s) => !s.voided).slice(0, 6)

    // Enrich recent sales with product names
    const saleProductIds = [...new Set(recentSales.map((s) => s.productId))]
    const saleProducts = await Promise.all(
      saleProductIds.map((id) => ctx.db.get(id)),
    )
    const saleProductMap = new Map(
      saleProducts.filter(Boolean).map((p) => [p!._id, p!.name]),
    )

    // Enrich recent purchases with product names
    const purchaseProductIds = [
      ...new Set(allRecentPurchases.map((p) => p.productId)),
    ]
    const purchaseProducts = await Promise.all(
      purchaseProductIds.map((id) => ctx.db.get(id)),
    )
    const purchaseProductMap = new Map(
      purchaseProducts.filter(Boolean).map((p) => [p!._id, p!.name]),
    )

    // Low stock: sorted by most critical (lowest qty/reorderLevel ratio first)
    const lowStock = allProducts
      .filter((p) => p.qty <= p.reorderLevel)
      .sort((a, b) => a.qty / (a.reorderLevel || 1) - b.qty / (b.reorderLevel || 1))
      .slice(0, 8)

    return {
      today: {
        revenue: activeTodaySales.reduce((s, x) => s + x.revenue, 0),
        grossProfit: activeTodaySales.reduce(
          (s, x) => s + (x.revenue - x.cogs),
          0,
        ),
        transactions: activeTodaySales.length,
      },
      month: {
        revenue: activeMonthSales.reduce((s, x) => s + x.revenue, 0),
        grossProfit: activeMonthSales.reduce(
          (s, x) => s + (x.revenue - x.cogs),
          0,
        ),
        transactions: activeMonthSales.length,
      },
      recentSales: recentSales.map((s) => ({
        _id: s._id,
        date: s.date,
        productName: saleProductMap.get(s.productId) ?? 'Deleted Product',
        qty: s.qty,
        revenue: s.revenue,
        createdBy: s.createdBy,
      })),
      recentPurchases: allRecentPurchases.map((p) => ({
        _id: p._id,
        date: p.date,
        productName: purchaseProductMap.get(p.productId) ?? 'Deleted Product',
        qty: p.qty,
        totalCost: p.totalCost,
        supplier: p.supplier,
      })),
      lowStock,
      lowStockCount: allProducts.filter((p) => p.qty <= p.reorderLevel).length,
      totalProducts: allProducts.length,
    }
  },
})
