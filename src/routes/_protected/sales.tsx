import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfDay, endOfDay } from 'date-fns'
import {
  PlusIcon, CalendarIcon, TrendingUpIcon, XIcon, BanIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_protected/sales')({
  component: SalesPage,
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const saleSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  date: z.date({ required_error: 'Date is required' }),
  qty: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1'),
  sellingPrice: z.coerce.number().min(0, 'Must be ≥ 0'),
  discount: z.coerce.number().min(0, 'Must be ≥ 0'),
})

type SaleFormData = z.infer<typeof saleSchema>
type Role = 'admin' | 'manager' | 'viewer'

type Sale = {
  _id: Id<'sales'>
  productId: Id<'products'>
  productName: string
  productSku: string
  qty: number
  sellingPrice: number
  discount: number
  cogs: number
  revenue: number
  date: number
  voided?: boolean
  createdBy: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString()
}

function DatePickerButton({
  value,
  onChange,
  placeholder,
}: {
  value: Date | undefined
  onChange: (d: Date | undefined) => void
  placeholder: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal gap-2 min-w-36">
          <CalendarIcon className="size-4 opacity-50 shrink-0" />
          {value ? format(value, 'dd MMM yyyy') : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

// ─── Record Sale Sheet ────────────────────────────────────────────────────────

function RecordSaleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useQuery(api.products.listProducts)
  const createSale = useMutation(api.sales.createSale)

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: { productId: '', date: new Date(), qty: 1, sellingPrice: 0, discount: 0 },
  })

  const selectedProductId = form.watch('productId')
  const qty = Number(form.watch('qty') ?? 0)
  const sellingPrice = Number(form.watch('sellingPrice') ?? 0)
  const discount = Number(form.watch('discount') ?? 0)

  const selectedProduct = products?.find((p) => p._id === selectedProductId)
  const cogs = (selectedProduct?.unitCost ?? 0) * qty
  const revenue = sellingPrice * qty - discount

  async function onSubmit(data: SaleFormData) {
    try {
      await createSale({
        productId: data.productId as Id<'products'>,
        date: data.date.getTime(),
        qty: data.qty,
        sellingPrice: data.sellingPrice,
        discount: data.discount,
      })
      toast.success('Sale recorded')
      form.reset({ productId: '', date: new Date(), qty: 1, sellingPrice: 0, discount: 0 })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record sale')
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Record Sale</SheetTitle>
          <SheetDescription>
            Stock will be deducted automatically. Discount is a flat amount off the total.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}
            className="flex flex-col gap-4 flex-1 py-4"
          >
            {/* Product */}
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p._id} value={p._id} disabled={p.qty === 0}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{p.sku}</span>
                          {p.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            (stock: {p.qty})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 size-4 opacity-50" />
                          {field.value ? format(field.value, 'dd MMM yyyy') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(d) => d > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Qty + Selling Price */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Quantity
                      {selectedProduct && (
                        <span className="text-muted-foreground font-normal ml-1">
                          (max {selectedProduct.qty})
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={selectedProduct?.qty}
                        step={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price / unit</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Discount */}
            <FormField
              control={form.control}
              name="discount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Discount{' '}
                    <span className="text-muted-foreground font-normal">(flat amount, optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="any" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Computed summary */}
            <div className="rounded-md bg-muted text-sm divide-y divide-border">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">COGS</span>
                <span className="tabular-nums">{fmtNumber(cogs)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 font-medium">
                <span>Revenue</span>
                <span className="tabular-nums">{fmtNumber(revenue)}</span>
              </div>
            </div>

            <SheetFooter className="mt-auto pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Recording…' : 'Record Sale'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Void Sale Dialog ─────────────────────────────────────────────────────────

function VoidSaleDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const voidSale = useMutation(api.sales.voidSale)
  const [isPending, setIsPending] = useState(false)

  async function handleVoid() {
    if (!sale) return
    setIsPending(true)
    try {
      await voidSale({ id: sale._id })
      toast.success('Sale voided — stock restored')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void sale')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Void Sale</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Void the sale of{' '}
          <span className="font-semibold text-foreground">
            {sale?.qty} × {sale?.productName}
          </span>{' '}
          on {sale ? format(new Date(sale.date), 'dd MMM yyyy') : ''}? Stock will be
          restored.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleVoid()} disabled={isPending}>
            {isPending ? 'Voiding…' : 'Void Sale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SalesPage() {
  const sales = useQuery(api.sales.listSales)
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  const [sheetOpen, setSheetOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()

  const hasFilters = !!fromDate || !!toDate
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!sales) return []
    return sales.filter((s) => {
      if (fromDate && s.date < startOfDay(fromDate).getTime()) return false
      if (toDate && s.date > endOfDay(toDate).getTime()) return false
      return true
    })
  }, [sales, fromDate, toDate])

  useEffect(() => { setPage(0) }, [fromDate, toDate])

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totals = useMemo(() => {
    const active = filtered.filter((s) => !s.voided)
    return {
      revenue: active.reduce((sum, s) => sum + s.revenue, 0),
      cogs: active.reduce((sum, s) => sum + s.cogs, 0),
      grossProfit: active.reduce((sum, s) => sum + (s.revenue - s.cogs), 0),
    }
  }, [filtered])

  const canRecord = role === 'admin' || role === 'manager'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {sales !== undefined
              ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`
              : 'Loading…'}
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setSheetOpen(true)} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />
            Record Sale
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {sales !== undefined && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Revenue', value: totals.revenue },
            { label: 'COGS', value: totals.cogs },
            { label: 'Gross Profit', value: totals.grossProfit },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fmtNumber(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePickerButton value={fromDate} onChange={setFromDate} placeholder="From date" />
        <DatePickerButton value={toDate} onChange={setToDate} placeholder="To date" />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFromDate(undefined); setToDate(undefined) }}
            className="gap-1.5 text-muted-foreground"
          >
            <XIcon className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {sales === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {['Date', 'Product', 'Qty', 'Selling Price', 'Discount', 'COGS', 'Revenue', 'Status', ''].map(
                  (h) => <TableHead key={h}>{h}</TableHead>,
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <TrendingUpIcon className="size-10 opacity-30" />
          <p className="text-sm">
            {hasFilters ? 'No sales match your filters' : 'No sales recorded yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price/unit</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
                {canRecord && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s._id}
                  className={s.voided ? 'opacity-50' : undefined}
                >
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(s.date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className={s.voided ? 'line-through' : 'font-medium'}>
                      {s.productName}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{s.productSku}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(s.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(s.sellingPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(s.discount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(s.cogs)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtNumber(s.revenue)}</TableCell>
                  <TableCell>
                    {s.voided ? (
                      <Badge variant="destructive" className="text-xs">Voided</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    )}
                  </TableCell>
                  {canRecord && (
                    <TableCell>
                      {!s.voided && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setVoidTarget(s as Sale)}
                        >
                          <BanIcon className="size-3.5" />
                          <span className="sr-only">Void</span>
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RecordSaleSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <VoidSaleDialog sale={voidTarget} onClose={() => setVoidTarget(null)} />
    </div>
  )
}
