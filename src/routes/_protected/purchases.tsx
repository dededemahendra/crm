import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfDay, endOfDay } from 'date-fns'
import {
  PlusIcon,
  CalendarIcon,
  ShoppingCartIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const purchaseSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  date: z.date(),
  qty: z.coerce
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1'),
  unitCost: z.coerce.number().min(0, 'Must be ≥ 0'),
  supplier: z.string().min(1, 'Supplier is required'),
  invoiceNo: z.string().optional(),
})

type PurchaseFormData = z.infer<typeof purchaseSchema>

type Role = 'admin' | 'manager' | 'viewer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString()
}

// ─── Record Purchase Sheet ────────────────────────────────────────────────────

function RecordPurchaseSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
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
    },
  })

  const qty = form.watch('qty') ?? 0
  const unitCost = form.watch('unitCost') ?? 0
  const totalCost = Number(qty) * Number(unitCost)

  function handleProductChange(productId: string) {
    form.setValue('productId', productId)
    const product = products?.find((p) => p._id === productId)
    if (product) {
      form.setValue('unitCost', product.unitCost)
    }
  }

  async function onSubmit(data: PurchaseFormData) {
    try {
      await createPurchase({
        productId: data.productId as Parameters<
          typeof createPurchase
        >[0]['productId'],
        date: data.date.getTime(),
        qty: data.qty,
        unitCost: data.unitCost,
        totalCost,
        supplier: data.supplier,
        invoiceNo: data.invoiceNo?.trim() || undefined,
      })
      toast.success('Purchase recorded')
      form.reset({
        productId: '',
        date: new Date(),
        qty: 1,
        unitCost: 0,
        supplier: '',
        invoiceNo: '',
      })
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to record purchase',
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Record Purchase</SheetTitle>
          <SheetDescription>
            Record incoming stock. Product quantity and unit cost will be
            updated automatically.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e)
            }}
            className="flex flex-col gap-4 flex-1 px-4 py-4"
          >
            {/* Product */}
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    onValueChange={handleProductChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {p.sku}
                          </span>
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
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 size-4 opacity-50" />
                          {field.value
                            ? format(field.value, 'dd MMM yyyy')
                            : 'Pick a date'}
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
                    <FormLabel>Quantity</FormLabel>
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
                    <FormLabel>Unit Cost</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total Cost (read-only) */}
            <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Cost</span>
              <span className="font-semibold tabular-nums">
                {fmtNumber(totalCost)}
              </span>
            </div>

            {/* Supplier */}
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
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
                  <FormLabel>
                    Invoice No{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="INV-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="mt-auto pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Recording…' : 'Record Purchase'}
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
        <Button
          variant="outline"
          className="justify-start text-left font-normal gap-2 min-w-36"
        >
          <CalendarIcon className="size-4 opacity-50 shrink-0" />
          {value ? (
            format(value, 'dd MMM yyyy')
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PurchasesPage() {
  const purchases = useQuery(api.purchases.listPurchases)
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  const [sheetOpen, setSheetOpen] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()

  const hasFilters = !!supplier || !!fromDate || !!toDate
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!purchases) return []
    return purchases.filter((p) => {
      if (
        supplier &&
        !p.supplier.toLowerCase().includes(supplier.toLowerCase())
      )
        return false
      if (fromDate && p.date < startOfDay(fromDate).getTime()) return false
      if (toDate && p.date > endOfDay(toDate).getTime()) return false
      return true
    })
  }, [purchases, supplier, fromDate, toDate])

  useEffect(() => {
    setPage(0)
  }, [supplier, fromDate, toDate])

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const canRecord = role === 'admin' || role === 'manager'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {purchases !== undefined
              ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`
              : 'Loading…'}
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setSheetOpen(true)} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />
            Record Purchase
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by supplier…"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="max-w-xs"
        />
        <DatePickerButton
          value={fromDate}
          onChange={setFromDate}
          placeholder="From date"
        />
        <DatePickerButton
          value={toDate}
          onChange={setToDate}
          placeholder="To date"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSupplier('')
              setFromDate(undefined)
              setToDate(undefined)
            }}
            className="gap-1.5 text-muted-foreground"
          >
            <XIcon className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {purchases === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Date',
                  'Product',
                  'Supplier',
                  'Invoice No',
                  'Qty',
                  'Unit Cost',
                  'Total Cost',
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
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
            {hasFilters
              ? 'No purchases match your filters'
              : 'No purchases recorded yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => (
                <TableRow key={p._id}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(p.date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {p.productSku}
                    </div>
                  </TableCell>
                  <TableCell>{p.supplier}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.invoiceNo ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(p.qty)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(p.unitCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtNumber(p.totalCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="size-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRightIcon className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <RecordPurchaseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
