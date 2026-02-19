import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { format } from 'date-fns'
import {
  TrendingUpIcon,
  ShoppingCartIcon,
  PackageIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
  isLoading,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  highlight?: 'positive' | 'warning'
  isLoading?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <div>
          <p
            className={`text-2xl font-bold tabular-nums ${
              highlight === 'positive'
                ? 'text-green-600 dark:text-green-400'
                : highlight === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : ''
            }`}
          >
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  linkTo,
  linkLabel = 'View all',
}: {
  title: string
  linkTo: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-sm">{title}</h2>
      <Link
        to={linkTo}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {linkLabel}
        <ArrowRightIcon className="size-3" />
      </Link>
    </div>
  )
}

// ─── Recent Sales Panel ───────────────────────────────────────────────────────

function RecentSalesPanel({
  sales,
  isLoading,
}: {
  sales: { _id: string; date: number; productName: string; qty: number; revenue: number; createdBy: string }[]
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 pt-4 pb-2">
        <SectionHeader title="Recent Sales" linkTo="/sales" />
      </div>
      <Separator />
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-md shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <TrendingUpIcon className="size-8 opacity-30" />
          <p className="text-sm">No sales yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {sales.map((s) => (
            <div key={s._id} className="flex items-center gap-3 px-4 py-3">
              <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUpIcon className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {s.qty} unit{s.qty !== 1 ? 's' : ''} ·{' '}
                  {format(new Date(s.date), 'dd MMM, HH:mm')}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">
                {fmtNumber(s.revenue)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Low Stock Panel ──────────────────────────────────────────────────────────

function LowStockPanel({
  products,
  isLoading,
}: {
  products: { _id: string; name: string; qty: number; reorderLevel: number; unit: string }[]
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 pt-4 pb-2">
        <SectionHeader title="Low Stock Alerts" linkTo="/products" linkLabel="Manage products" />
      </div>
      <Separator />
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <PackageIcon className="size-8 opacity-30" />
          <p className="text-sm">All products are well-stocked</p>
        </div>
      ) : (
        <div className="divide-y">
          {products.map((p) => (
            <div key={p._id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Reorder at {p.reorderLevel} {p.unit}
                </p>
              </div>
              {p.qty === 0 ? (
                <Badge variant="destructive" className="shrink-0 text-xs">
                  Out of stock
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs border-amber-500 text-amber-600 dark:text-amber-400"
                >
                  {p.qty} left
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Recent Purchases Panel ───────────────────────────────────────────────────

function RecentPurchasesPanel({
  purchases,
  isLoading,
}: {
  purchases: { _id: string; date: number; productName: string; qty: number; totalCost: number; supplier: string }[]
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 pt-4 pb-2">
        <SectionHeader title="Recent Purchases" linkTo="/purchases" />
      </div>
      <Separator />
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-md shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <ShoppingCartIcon className="size-8 opacity-30" />
          <p className="text-sm">No purchases yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {purchases.map((p) => (
            <div key={p._id} className="flex items-center gap-3 px-4 py-3">
              <div className="size-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                <ShoppingCartIcon className="size-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {p.qty} units · {p.supplier} ·{' '}
                  {format(new Date(p.date), 'dd MMM')}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">
                {fmtNumber(p.totalCost)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const data = useQuery(api.dashboard.getDashboardData)
  const profile = useQuery(api.users.getMyProfile)
  const isLoading = data === undefined

  const now = new Date()
  const monthName = format(now, 'MMMM yyyy')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Good {getGreeting()},{' '}
          {profile?.name?.split(' ')[0] ?? '—'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(now, 'EEEE, dd MMMM yyyy')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Today's Revenue"
          value={isLoading ? '—' : fmtNumber(data.today.revenue)}
          sub={`${isLoading ? '—' : data.today.transactions} transaction${data?.today.transactions !== 1 ? 's' : ''}`}
          icon={TrendingUpIcon}
          highlight="positive"
          isLoading={isLoading}
        />
        <KPICard
          label="Today's Gross Profit"
          value={isLoading ? '—' : fmtNumber(data.today.grossProfit)}
          sub="Revenue minus COGS"
          icon={TrendingUpIcon}
          highlight={!isLoading && data.today.grossProfit >= 0 ? 'positive' : undefined}
          isLoading={isLoading}
        />
        <KPICard
          label={`${monthName} Revenue`}
          value={isLoading ? '—' : fmtNumber(data.month.revenue)}
          sub={`${isLoading ? '—' : data.month.transactions} transaction${data?.month.transactions !== 1 ? 's' : ''}`}
          icon={TrendingUpIcon}
          isLoading={isLoading}
        />
        <KPICard
          label={`${monthName} Gross Profit`}
          value={isLoading ? '—' : fmtNumber(data.month.grossProfit)}
          sub={
            !isLoading && data.lowStockCount > 0
              ? `⚠ ${data.lowStockCount} low-stock item${data.lowStockCount !== 1 ? 's' : ''}`
              : 'All stock levels OK'
          }
          icon={data && data.lowStockCount > 0 ? AlertTriangleIcon : PackageIcon}
          highlight={!isLoading && data?.lowStockCount > 0 ? 'warning' : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Middle row: Recent Sales + Low Stock */}
      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <RecentSalesPanel
            sales={(data?.recentSales ?? []) as Parameters<typeof RecentSalesPanel>[0]['sales']}
            isLoading={isLoading}
          />
        </div>
        <div className="md:col-span-2">
          <LowStockPanel
            products={(data?.lowStock ?? []) as Parameters<typeof LowStockPanel>[0]['products']}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Recent Purchases */}
      <RecentPurchasesPanel
        purchases={(data?.recentPurchases ?? []) as Parameters<typeof RecentPurchasesPanel>[0]['purchases']}
        isLoading={isLoading}
      />
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
