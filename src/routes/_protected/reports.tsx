import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfDay, endOfDay,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from 'date-fns'
import { CalendarIcon, DownloadIcon, BarChart3Icon, PrinterIcon } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_protected/reports')({
  component: ReportsPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'month' | 'year' | 'custom'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getPeriodDates(
  period: Period,
  customFrom?: Date,
  customTo?: Date,
): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) }
    case 'custom':
      return {
        start: customFrom ? startOfDay(customFrom) : startOfMonth(now),
        end: customTo ? endOfDay(customTo) : endOfMonth(now),
      }
  }
}

function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(','),
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── CSS Bar ─────────────────────────────────────────────────────────────────

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
      <div
        className={`h-full rounded-full ${className ?? 'bg-primary'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  suffix,
  highlight,
  isLoading,
}: {
  label: string
  value: number
  suffix?: string
  highlight?: 'positive' | 'negative'
  isLoading?: boolean
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-7 w-28 mt-1" />
      ) : (
        <p
          className={`text-xl font-bold tabular-nums ${
            highlight === 'positive'
              ? 'text-green-600 dark:text-green-400'
              : highlight === 'negative'
                ? 'text-destructive'
                : ''
          }`}
        >
          {fmtNumber(value)}{suffix ?? ''}
        </p>
      )}
    </div>
  )
}

// ─── P&L Statement ───────────────────────────────────────────────────────────

function PLStatement({ metrics }: { metrics: ReturnType<typeof computeMetrics> }) {
  const { t } = useTranslation()
  const rows: { label: string; value: number; indent?: boolean; bold?: boolean; separator?: boolean }[] = [
    { label: `${t('reports.revenue')} (Sales)`, value: metrics.revenue },
    { label: t('reports.otherIncome'), value: metrics.otherIncomeTotal },
    { label: 'Total Income', value: metrics.totalIncome, bold: true, separator: true },
    { label: `${t('reports.cogs')}`, value: -metrics.cogs, indent: true },
    { label: t('reports.grossProfit'), value: metrics.grossProfit, bold: true, separator: true },
    { label: t('reports.opEx'), value: -metrics.opExTotal, indent: true },
    { label: 'Operating Income', value: metrics.operatingIncome, bold: true, separator: true },
    { label: t('reports.otherIncome'), value: metrics.otherIncomeTotal, indent: true },
    { label: 'Profit Before Tax', value: metrics.profitBeforeTax, bold: true, separator: true },
    ...(metrics.taxRate > 0
      ? [{ label: `Tax (${metrics.taxRate}%)`, value: -metrics.tax, indent: true }]
      : []),
    { label: t('reports.netProfit'), value: metrics.netProfit, bold: true, separator: true },
  ]

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 border-b">
        <h2 className="font-semibold text-sm">{t('reports.plStatement')}</h2>
      </div>
      <div className="divide-y">
        {rows.map((row, i) => (
          <div key={i}>
            {row.separator && <Separator />}
            <div
              className={`flex items-center justify-between px-4 py-2.5 ${row.bold ? 'bg-muted/30' : ''}`}
            >
              <span
                className={`text-sm ${row.indent ? 'pl-4 text-muted-foreground' : row.bold ? 'font-semibold' : ''}`}
              >
                {row.label}
              </span>
              <span
                className={`tabular-nums text-sm ${row.bold ? 'font-bold' : ''} ${
                  row.value < 0 ? 'text-destructive' : row.bold && row.value > 0 ? 'text-green-600 dark:text-green-400' : ''
                }`}
              >
                {row.value < 0 ? `(${fmtNumber(Math.abs(row.value))})` : fmtNumber(row.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Metrics computation ─────────────────────────────────────────────────────

function computeMetrics(
  data: { sales: { revenue: number; cogs: number; date: number; productName: string; productSku: string; qty: number; productId: string }[]; expenses: { amount: number; category: string; date: number }[]; otherIncome: { amount: number; source: string; date: number }[] },
  taxRate = 0,
) {
  const revenue = data.sales.reduce((s, x) => s + x.revenue, 0)
  const cogs = data.sales.reduce((s, x) => s + x.cogs, 0)
  const grossProfit = revenue - cogs
  const opExTotal = data.expenses.reduce((s, x) => s + x.amount, 0)
  const operatingIncome = grossProfit - opExTotal
  const otherIncomeTotal = data.otherIncome.reduce((s, x) => s + x.amount, 0)
  const profitBeforeTax = operatingIncome + otherIncomeTotal
  const tax = profitBeforeTax > 0 ? profitBeforeTax * (taxRate / 100) : 0
  const netProfit = profitBeforeTax - tax
  const totalIncome = revenue + otherIncomeTotal

  const productMap = new Map<string, { name: string; sku: string; revenue: number; qty: number }>()
  data.sales.forEach((s) => {
    const existing = productMap.get(s.productId) ?? { name: s.productName, sku: s.productSku, revenue: 0, qty: 0 }
    productMap.set(s.productId, { ...existing, revenue: existing.revenue + s.revenue, qty: existing.qty + s.qty })
  })
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const catMap = new Map<string, number>()
  data.expenses.forEach((e) => {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount)
  })
  const expenseByCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const monthMap = new Map<string, { label: string; revenue: number; cogs: number; expenses: number }>()
  data.sales.forEach((s) => {
    const key = format(new Date(s.date), 'yyyy-MM')
    const label = format(new Date(s.date), 'MMM yy')
    const existing = monthMap.get(key) ?? { label, revenue: 0, cogs: 0, expenses: 0 }
    monthMap.set(key, { ...existing, revenue: existing.revenue + s.revenue, cogs: existing.cogs + s.cogs })
  })
  data.expenses.forEach((e) => {
    const key = format(new Date(e.date), 'yyyy-MM')
    const label = format(new Date(e.date), 'MMM yy')
    const existing = monthMap.get(key) ?? { label, revenue: 0, cogs: 0, expenses: 0 }
    monthMap.set(key, { ...existing, expenses: existing.expenses + e.amount })
  })
  const monthlyTrend = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const costRatioPct = revenue > 0 ? (cogs / revenue) * 100 : 0

  return {
    revenue, cogs, grossProfit, opExTotal, operatingIncome,
    otherIncomeTotal, profitBeforeTax, tax, taxRate, netProfit, totalIncome,
    grossMarginPct, costRatioPct,
    topProducts, expenseByCategory, monthlyTrend,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReportsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState<Date | undefined>()
  const [customTo, setCustomTo] = useState<Date | undefined>()

  const PERIOD_LABELS: Record<Period, string> = {
    today: t('reports.today'),
    month: t('reports.thisMonth'),
    year: t('reports.thisYear'),
    custom: t('reports.custom'),
  }

  const { start, end } = useMemo(
    () => getPeriodDates(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const data = useQuery(api.reports.getPLData, {
    startDate: start.getTime(),
    endDate: end.getTime(),
  })
  const appSettings = useQuery(api.settings.getSettings)
  const taxRate = appSettings?.taxRate ?? 0

  const metrics = useMemo(
    () =>
      data
        ? computeMetrics(data as Parameters<typeof computeMetrics>[0], taxRate)
        : null,
    [data, taxRate],
  )

  const isLoading = data === undefined

  const periodLabel = period === 'custom' && customFrom
    ? `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`
    : PERIOD_LABELS[period]

  function handleExport() {
    if (!metrics) return
    const rows: (string | number)[][] = [
      ['Cafe CRM — P&L Report'],
      [`Period: ${periodLabel}`],
      [`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`],
      [],
      ['Item', 'Amount'],
      ['Revenue', metrics.revenue],
      ['COGS', metrics.cogs],
      ['Gross Profit', metrics.grossProfit],
      ['Operating Expenses', metrics.opExTotal],
      ['Operating Income', metrics.operatingIncome],
      ['Other Income', metrics.otherIncomeTotal],
      ['Profit Before Tax', metrics.profitBeforeTax],
      ...(metrics.taxRate > 0 ? [[`Tax (${metrics.taxRate}%)`, metrics.tax]] : []),
      ['Net Profit', metrics.netProfit],
      [],
      ['Top Products by Revenue'],
      ['Product', 'Qty Sold', 'Revenue'],
      ...metrics.topProducts.map((p) => [p.name, p.qty, p.revenue]),
      [],
      ['Expenses by Category'],
      ['Category', 'Amount'],
      ...metrics.expenseByCategory.map((e) => [e.category, e.amount]),
    ]
    downloadCSV(rows, `pl-report-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} disabled={!metrics} className="shrink-0">
            <PrinterIcon className="size-4 mr-2" />
            {t('common.print')}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!metrics} className="shrink-0">
            <DownloadIcon className="size-4 mr-2" />
            {t('common.export')}
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {(['today', 'month', 'year', 'custom'] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}

        {period === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="size-3.5 opacity-50" />
                  {customFrom ? format(customFrom, 'dd MMM yyyy') : t('common.fromDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="size-3.5 opacity-50" />
                  {customTo ? format(customTo, 'dd MMM yyyy') : t('common.toDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  disabled={(d) => !!customFrom && d < customFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t('reports.revenue')} value={metrics?.revenue ?? 0} isLoading={isLoading} />
        <KPICard label={t('reports.cogs')} value={metrics?.cogs ?? 0} isLoading={isLoading} />
        <KPICard
          label={t('reports.grossProfit')}
          value={metrics?.grossProfit ?? 0}
          highlight={(metrics?.grossProfit ?? 0) >= 0 ? 'positive' : 'negative'}
          isLoading={isLoading}
        />
        <KPICard
          label={t('reports.grossMargin')}
          value={Math.round(metrics?.grossMarginPct ?? 0)}
          suffix="%"
          highlight={(metrics?.grossMarginPct ?? 0) >= 0 ? 'positive' : 'negative'}
          isLoading={isLoading}
        />
        <KPICard label={t('reports.opEx')} value={metrics?.opExTotal ?? 0} isLoading={isLoading} />
        <KPICard label={t('reports.otherIncome')} value={metrics?.otherIncomeTotal ?? 0} isLoading={isLoading} />
        <KPICard
          label={t('reports.netProfit')}
          value={metrics?.netProfit ?? 0}
          highlight={(metrics?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}
          isLoading={isLoading}
        />
        <KPICard
          label={t('reports.costRatio')}
          value={Math.round(metrics?.costRatioPct ?? 0)}
          suffix="%"
          isLoading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      ) : metrics && data ? (
        <>
          {/* P&L Statement */}
          <PLStatement metrics={metrics} />

          {/* Top Products + Expense Breakdown */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b">
                <h2 className="font-semibold text-sm">{t('reports.topProducts')}</h2>
              </div>
              <div className="p-4">
                {metrics.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No sales in this period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {metrics.topProducts.map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          <div className="shrink-0 text-right">
                            <span className="tabular-nums font-semibold">{fmtNumber(p.revenue)}</span>
                            <span className="text-xs text-muted-foreground ml-1">({p.qty} sold)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bar
                            value={p.revenue}
                            max={metrics.topProducts[0]?.revenue ?? 1}
                          />
                          <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                            {metrics.revenue > 0
                              ? `${Math.round((p.revenue / metrics.revenue) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b">
                <h2 className="font-semibold text-sm">{t('reports.expenseBreakdown')}</h2>
              </div>
              <div className="p-4">
                {metrics.expenseByCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No expenses in this period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {metrics.expenseByCategory.map((e, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{e.category}</span>
                          <div className="shrink-0 text-right">
                            <span className="tabular-nums font-semibold">{fmtNumber(e.amount)}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {metrics.opExTotal > 0
                                ? `${Math.round((e.amount / metrics.opExTotal) * 100)}%`
                                : '0%'}
                            </span>
                          </div>
                        </div>
                        <Bar
                          value={e.amount}
                          max={metrics.expenseByCategory[0]?.amount ?? 1}
                          className="bg-destructive/60"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          {metrics.monthlyTrend.length > 1 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b">
                <h2 className="font-semibold text-sm">{t('reports.monthlyTrend')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Month</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('reports.revenue')}</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('reports.cogs')}</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('reports.opEx')}</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('reports.grossProfit')}</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {metrics.monthlyTrend.map((m, i) => {
                      const gp = m.revenue - m.cogs
                      const net = gp - m.expenses
                      return (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{m.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(m.revenue)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNumber(m.cogs)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNumber(m.expenses)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(gp)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                            {fmtNumber(net)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.sales.length === 0 && data.expenses.length === 0 && data.otherIncome.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground rounded-lg border">
              <BarChart3Icon className="size-10 opacity-30" />
              <p className="text-sm">{t('common.noData')}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
