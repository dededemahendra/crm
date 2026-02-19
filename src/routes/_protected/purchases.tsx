import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  PlusIcon,
  CalendarIcon,
  ShoppingCartIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanIcon,
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

export const Route = createFileRoute('/_protected/purchases')({
  component: PurchasesPage,
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_KEYS = ['cash', 'bank_transfer', 'credit', 'qris'] as const
type PaymentMethod = (typeof PAYMENT_METHOD_KEYS)[number]

const purchaseSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  date: z.date(),
  qty: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1'),
  unitCost: z.coerce.number().min(0, 'Must be ≥ 0'),
  supplier: z.string().min(1, 'Supplier is required'),
  invoiceNo: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'credit', 'qris']).optional(),
})

type PurchaseFormData = z.infer<typeof purchaseSchema>
type Role = 'admin' | 'manager' | 'viewer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString()
}

function PaymentBadge({ method }: { method?: string | null }) {
  const { t } = useTranslation()
  if (!method) return <span className="text-muted-foreground">—</span>
  const label = PAYMENT_METHOD_KEYS.includes(method as PaymentMethod)
    ? t(`payment.${method}`)
    : method
  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'cancelled') {
    return <Badge variant="destructive">{t('status.cancelled')}</Badge>
  }
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      {t('status.active')}
    </Badge>
  )
}

// ─── Cancel Purchase Dialog ───────────────────────────────────────────────────

function CancelPurchaseDialog({
  purchaseId,
  onClose,
}: {
  purchaseId: Id<'purchases'> | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const cancelPurchase = useMutation(api.purchases.cancelPurchase)
  const [isPending, setIsPending] = useState(false)

  async function handleCancel() {
    if (!purchaseId) return
    setIsPending(true)
    try {
      await cancelPurchase({ id: purchaseId })
      toast.success(t('purchases.cancelSuccess'))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel purchase')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!purchaseId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('purchases.cancelPurchase')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('purchases.cancelConfirm')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleCancel()}
            disabled={isPending}
          >
            {isPending ? t('common.saving') : t('purchases.cancelPurchase')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Record Purchase Sheet ────────────────────────────────────────────────────

function RecordPurchaseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const products = useQuery(api.products.listProducts)
  const createPurchase = useMutation(api.purchases.createPurchase)

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema) as Resolver<PurchaseFormData>,
    defaultValues: {
      productId: '',
      date: new Date(),
      qty: 1,
      unitCost: 0,
      supplier: '',
      invoiceNo: '',
      paymentMethod: undefined,
    },
  })

  const qty = form.watch('qty') ?? 0
  const unitCost = form.watch('unitCost') ?? 0
  const totalCost = Number(qty) * Number(unitCost)

  function handleProductChange(productId: string) {
    form.setValue('productId', productId)
    const product = products?.find((p) => p._id === productId)
    if (product) form.setValue('unitCost', product.unitCost)
  }

  async function onSubmit(data: PurchaseFormData) {
    try {
      await createPurchase({
        productId: data.productId as Parameters<typeof createPurchase>[0]['productId'],
        date: data.date.getTime(),
        qty: data.qty,
        unitCost: data.unitCost,
        totalCost,
        supplier: data.supplier,
        invoiceNo: data.invoiceNo?.trim() || undefined,
        paymentMethod: data.paymentMethod as PaymentMethod | undefined,
      })
      toast.success('Purchase recorded')
      form.reset({ productId: '', date: new Date(), qty: 1, unitCost: 0, supplier: '', invoiceNo: '' })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record purchase')
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('purchases.record')}</SheetTitle>
          <SheetDescription>{t('purchases.recordDesc')}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}
            className="flex flex-col gap-4 flex-1 px-4 py-4"
          >
            {/* Product */}
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchases.columns.product')}</FormLabel>
                  <Select onValueChange={handleProductChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{p.sku}</span>
                          {p.name}
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
                  <FormLabel>{t('purchases.columns.date')}</FormLabel>
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

            {/* Qty + Unit Cost */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchases.columns.qty')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchases.columns.unitCost')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total Cost */}
            <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('purchases.columns.totalCost')}</span>
              <span className="font-semibold tabular-nums">{fmtNumber(totalCost)}</span>
            </div>

            {/* Supplier */}
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchases.columns.supplier')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Supplier name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Invoice No */}
            <FormField
              control={form.control}
              name="invoiceNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchases.columns.invoiceNo')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span></FormLabel>
                  <FormControl>
                    <Input placeholder="INV-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchases.columns.payment')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHOD_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>{t(`payment.${key}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="mt-auto pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('common.saving') : t('purchases.record')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Date Picker Button ───────────────────────────────────────────────────────

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
          {value ? format(value, 'dd MMM yyyy') : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function PurchasesPage() {
  const { t } = useTranslation()
  const purchases = useQuery(api.purchases.listPurchases)
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  const [sheetOpen, setSheetOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Id<'purchases'> | null>(null)
  const [supplier, setSupplier] = useState('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all')
  const [page, setPage] = useState(0)

  const hasFilters = !!supplier || !!fromDate || !!toDate || statusFilter !== 'all'

  const filtered = useMemo(() => {
    if (!purchases) return []
    return purchases.filter((p) => {
      if (supplier && !p.supplier.toLowerCase().includes(supplier.toLowerCase())) return false
      if (fromDate && p.date < startOfDay(fromDate).getTime()) return false
      if (toDate && p.date > endOfDay(toDate).getTime()) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      return true
    })
  }, [purchases, supplier, fromDate, toDate, statusFilter])

  useEffect(() => { setPage(0) }, [supplier, fromDate, toDate, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const canRecord = role === 'admin' || role === 'manager'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('purchases.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {purchases !== undefined
              ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`
              : t('common.loading')}
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setSheetOpen(true)} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />
            {t('purchases.record')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={`${t('purchases.columns.supplier')}…`}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="max-w-xs"
        />
        <DatePickerButton value={fromDate} onChange={setFromDate} placeholder={t('common.fromDate')} />
        <DatePickerButton value={toDate} onChange={setToDate} placeholder={t('common.toDate')} />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('purchases.allStatus')}</SelectItem>
            <SelectItem value="active">{t('status.active')}</SelectItem>
            <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSupplier(''); setFromDate(undefined); setToDate(undefined); setStatusFilter('all') }}
            className="gap-1.5 text-muted-foreground"
          >
            <XIcon className="size-3.5" />
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      {/* Table */}
      {purchases === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[t('purchases.columns.date'), t('purchases.columns.status'), t('purchases.columns.product'), t('purchases.columns.supplier'), t('purchases.columns.invoiceNo'), t('purchases.columns.qty'), t('purchases.columns.unitCost'), t('purchases.columns.totalCost'), t('purchases.columns.payment'), t('common.actions')].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ShoppingCartIcon className="size-10 opacity-30" />
          <p className="text-sm">
            {hasFilters ? t('common.noData') : t('common.noData')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('purchases.columns.date')}</TableHead>
                <TableHead>{t('purchases.columns.status')}</TableHead>
                <TableHead>{t('purchases.columns.product')}</TableHead>
                <TableHead>{t('purchases.columns.supplier')}</TableHead>
                <TableHead>{t('purchases.columns.invoiceNo')}</TableHead>
                <TableHead className="text-right">{t('purchases.columns.qty')}</TableHead>
                <TableHead className="text-right">{t('purchases.columns.unitCost')}</TableHead>
                <TableHead className="text-right">{t('purchases.columns.totalCost')}</TableHead>
                <TableHead>{t('purchases.columns.payment')}</TableHead>
                {canRecord && <TableHead className="w-20">{t('common.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => (
                <TableRow
                  key={p._id}
                  className={p.status === 'cancelled' ? 'opacity-60 bg-muted/30' : undefined}
                >
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(p.date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.productSku}</div>
                  </TableCell>
                  <TableCell>{p.supplier}</TableCell>
                  <TableCell className="text-muted-foreground">{p.invoiceNo ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(p.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(p.unitCost)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtNumber(p.totalCost)}</TableCell>
                  <TableCell><PaymentBadge method={p.paymentMethod} /></TableCell>
                  {canRecord && (
                    <TableCell>
                      {p.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          title={t('purchases.cancelPurchase')}
                          onClick={() => setCancelTarget(p._id)}
                        >
                          <BanIcon className="size-3.5" />
                          <span className="sr-only">{t('common.cancel')}</span>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {t('common.showing', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon className="size-4 mr-1" />{t('common.previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              {t('common.next')}<ChevronRightIcon className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <RecordPurchaseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <CancelPurchaseDialog purchaseId={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  )
}
