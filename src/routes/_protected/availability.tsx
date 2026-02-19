import { useState, useMemo, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import * as XLSX from 'xlsx'
import { useTranslation } from 'react-i18next'
import {
  PlusIcon, PencilIcon, Trash2Icon, PackageIcon,
  SlidersHorizontalIcon, ChevronLeftIcon, ChevronRightIcon,
  UploadIcon, CalendarIcon,
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

export const Route = createFileRoute('/_protected/availability')({
  component: ProductsPage,
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  unitCost: z.coerce.number().min(0, 'Must be ≥ 0'),
  sellingPrice: z.coerce.number().min(0, 'Must be ≥ 0').optional(),
  qty: z.coerce.number().int('Must be a whole number').min(0, 'Must be ≥ 0'),
  reorderLevel: z.coerce.number().int('Must be a whole number').min(0, 'Must be ≥ 0'),
})

type ProductFormData = z.infer<typeof productSchema>

type Product = {
  _id: Id<'products'>
  sku: string
  name: string
  category: string
  unit: string
  unitCost: number
  sellingPrice?: number
  qty: number
  reorderLevel: number
  updatedAt: number
  totalPurchased?: number
  totalSold?: number
  totalAdjustment?: number
  totalTransfer?: number
  totalProduction?: number
  totalWaste?: number
  currentQty?: number
}

type Role = 'admin' | 'manager' | 'viewer'

const MOVEMENT_TYPE_KEYS = ['adjustment', 'transfer', 'production', 'waste'] as const
type MovementType = (typeof MOVEMENT_TYPE_KEYS)[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) { return n.toLocaleString() }

function StockBadge({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  const { t } = useTranslation()
  if (qty === 0) {
    return <Badge variant="destructive" className="tabular-nums">{t('status.outOfStock')}</Badge>
  }
  if (qty <= reorderLevel) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 tabular-nums">
        {t('status.lowStock')} — {fmtNumber(qty)}
      </Badge>
    )
  }
  return <span className="tabular-nums">{fmtNumber(qty)}</span>
}

function MovementCell({ value, positiveGreen = true }: { value: number; positiveGreen?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground tabular-nums">—</span>
  const isPositive = value > 0
  const colorClass = positiveGreen
    ? isPositive ? 'text-green-600 dark:text-green-400' : 'text-destructive'
    : isPositive ? 'text-destructive' : 'text-green-600 dark:text-green-400'
  return (
    <span className={`tabular-nums font-medium ${colorClass}`}>
      {isPositive ? '+' : ''}{fmtNumber(value)}
    </span>
  )
}

// ─── Product Form ─────────────────────────────────────────────────────────────

function ProductForm({
  form, onSubmit, isPending, submitLabel, onCancel,
}: {
  form: ReturnType<typeof useForm<ProductFormData>>
  onSubmit: (data: ProductFormData) => Promise<void>
  isPending: boolean
  submitLabel: string
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <Form {...form}>
      <form
        onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="sku" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('availability.columns.sku')}</FormLabel>
              <FormControl><Input placeholder="CF-001" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('availability.columns.name')}</FormLabel>
              <FormControl><Input placeholder="Arabica Coffee" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('availability.columns.category')}</FormLabel>
              <FormControl><Input placeholder="Drinks, Snacks, Food Materials…" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('availability.columns.unit')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'bottle', 'sachet', 'portion'].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="unitCost" render={({ field }) => (
            <FormItem>
              <FormLabel>Unit Cost</FormLabel>
              <FormControl><Input type="number" min={0} step="any" placeholder="0" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="sellingPrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Selling Price <span className="text-muted-foreground font-normal">{t('common.optional')}</span></FormLabel>
              <FormControl><Input type="number" min={0} step="any" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="qty" render={({ field }) => (
            <FormItem>
              <FormLabel>Qty</FormLabel>
              <FormControl><Input type="number" min={0} step={1} placeholder="0" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="reorderLevel" render={({ field }) => (
            <FormItem>
              <FormLabel>Reorder Level</FormLabel>
              <FormControl><Input type="number" min={0} step={1} placeholder="10" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={isPending}>{isPending ? t('common.saving') : submitLabel}</Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ─── Add Product Dialog ───────────────────────────────────────────────────────

function AddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const createProduct = useMutation(api.products.createProduct)
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormData>,
    defaultValues: { sku: '', name: '', category: '', unit: '', unitCost: 0, sellingPrice: undefined, qty: 0, reorderLevel: 10 },
  })

  async function onSubmit(data: ProductFormData) {
    try {
      await createProduct(data)
      toast.success('Item added')
      form.reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  function handleClose() { form.reset(); onClose() }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('availability.addItem')}</DialogTitle></DialogHeader>
        <ProductForm form={form} onSubmit={onSubmit} isPending={form.formState.isSubmitting} submitLabel={t('availability.addItem')} onCancel={handleClose} />
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Product Dialog ──────────────────────────────────────────────────────

function EditProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation()
  const updateProduct = useMutation(api.products.updateProduct)
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormData>,
    values: product ? {
      sku: product.sku, name: product.name, category: product.category,
      unit: product.unit, unitCost: product.unitCost, sellingPrice: product.sellingPrice,
      qty: product.qty, reorderLevel: product.reorderLevel,
    } : undefined,
  })

  async function onSubmit(data: ProductFormData) {
    if (!product) return
    try {
      await updateProduct({ id: product._id, ...data })
      toast.success('Item updated')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('availability.editItem')}</DialogTitle></DialogHeader>
        <ProductForm form={form} onSubmit={onSubmit} isPending={form.formState.isSubmitting} submitLabel={t('common.save')} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Product Dialog ────────────────────────────────────────────────────

function DeleteProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation()
  const deleteProduct = useMutation(api.products.deleteProduct)
  const [isPending, setIsPending] = useState(false)

  async function handleDelete() {
    if (!product) return
    setIsPending(true)
    try {
      await deleteProduct({ id: product._id })
      toast.success('Item deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item')
    } finally { setIsPending(false) }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t('availability.deleteItem')}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('availability.deleteConfirm', { name: product?.name ?? '' })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isPending}>
            {isPending ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Adjust Stock Dialog ──────────────────────────────────────────────────────

function AdjustStockDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation()
  const adjustStock = useMutation(api.products.adjustStock)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('adjustment')
  const [date, setDate] = useState<Date>(new Date())
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (product) { setQty(String(product.qty)); setReason(''); setMovementType('adjustment'); setDate(new Date()) }
  }, [product])

  async function handleSave() {
    if (!product) return
    const newQty = parseInt(qty, 10)
    if (isNaN(newQty) || newQty < 0) { toast.error('Quantity must be a non-negative number'); return }
    if (!reason.trim()) { toast.error('Please enter a reason'); return }
    setIsPending(true)
    try {
      await adjustStock({ id: product._id, qty: newQty, reason: reason.trim(), type: movementType, date: date.getTime() })
      toast.success(`Stock adjusted to ${newQty} ${product.unit}`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust stock')
    } finally { setIsPending(false) }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t('availability.stockMovement')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{product?.name}</p>
            <p className="text-xs text-muted-foreground">Current: {product?.qty} {product?.unit}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('availability.movementType')}</label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as MovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>{t(`availability.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('availability.newQty')}</label>
            <Input type="number" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('availability.reason')}</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the reason…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 size-4 opacity-50" />
                  {format(date, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} disabled={(d) => d > new Date()} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={isPending}>
            {isPending ? t('common.saving') : t('availability.applyMovement')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import XLSX Dialog ───────────────────────────────────────────────────────

type ImportRow = { sku: string; name: string; unit: string; qty: number; category?: string }

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const bulkUpsert = useMutation(api.products.bulkUpsertProducts)
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        const parsed: ImportRow[] = []
        for (const row of json) {
          const sku = String(row['SKU'] ?? row['sku'] ?? '').trim()
          const name = String(row['Nama'] ?? row['name'] ?? row['Name'] ?? '').trim()
          const unit = String(row['Satuan'] ?? row['unit'] ?? row['Unit'] ?? '').trim()
          const qty = Number(row['Qty Akhir'] ?? row['qty'] ?? row['Qty'] ?? 0)
          const category = String(row['Category'] ?? row['Kategori'] ?? '').trim() || undefined
          if (!sku || !name) continue
          parsed.push({ sku, name, unit: unit || 'pcs', qty: isNaN(qty) ? 0 : qty, category })
        }

        if (parsed.length === 0) {
          setError('No valid rows found. Make sure the file has SKU and Nama columns.')
          return
        }
        setRows(parsed)
      } catch {
        setError('Failed to parse file. Please use a valid .xlsx or .csv file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (rows.length === 0) return
    setIsPending(true)
    try {
      const result = await bulkUpsert({ products: rows })
      toast.success(t('availability.importComplete', { created: result.created, updated: result.updated }))
      setRows([])
      if (fileRef.current) fileRef.current.value = ''
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally { setIsPending(false) }
  }

  function handleClose() {
    setRows([]); setError('')
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('availability.import')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{t('availability.importDesc')}</p>
            <p className="text-xs">Optional: Kategori. Columns Qty Awal, Purchase, Sales, Transfer, Adjustment, Produksi, Waste Goods are recognized but not imported.</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:cursor-pointer"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {rows.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{rows.length} row{rows.length !== 1 ? 's' : ''} ready to import</p>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('availability.columns.sku')}</TableHead>
                      <TableHead>{t('availability.columns.name')}</TableHead>
                      <TableHead>{t('availability.columns.unit')}</TableHead>
                      <TableHead className="text-right">{t('availability.columns.qtyAkhir')}</TableHead>
                      <TableHead>{t('availability.columns.category')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNumber(r.qty)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.category ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>{t('common.cancel')}</Button>
          <Button onClick={() => void handleImport()} disabled={isPending || rows.length === 0}>
            {isPending ? 'Importing…' : `${t('common.import')}${rows.length > 0 ? ` (${rows.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

function DatePickerButton({ value, onChange, placeholder }: { value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string }) {
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

function ProductsPage() {
  const { t } = useTranslation()
  const now = new Date()
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(now))
  const [toDate, setToDate] = useState<Date>(endOfMonth(now))

  const summary = useQuery(api.products.getStockSummary, {
    startDate: fromDate.getTime(),
    endDate: toDate.getTime(),
  })
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)
  const [page, setPage] = useState(0)

  const categories = useMemo(() => {
    if (!summary) return []
    return [...new Set(summary.map((p) => p.category))].sort()
  }, [summary])

  const filtered = useMemo(() => {
    if (!summary) return []
    const q = search.toLowerCase()
    return summary.filter((p) => {
      const matchSearch = q === '' || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [summary, search, categoryFilter])

  const lowStockCount = useMemo(
    () => (summary ?? []).filter((p) => p.qty <= p.reorderLevel).length,
    [summary],
  )

  useEffect(() => { setPage(0) }, [search, categoryFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const canAdd = role === 'admin' || role === 'manager'
  const canEdit = role === 'admin' || role === 'manager'
  const canDelete = role === 'admin'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('availability.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {summary !== undefined
              ? `${summary.length} item${summary.length !== 1 ? 's' : ''}${lowStockCount > 0 ? ` · ${lowStockCount} ${t('status.lowStock').toLowerCase()}` : ''}`
              : t('common.loading')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canAdd && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadIcon className="size-4 mr-2" />{t('common.import')}
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon className="size-4 mr-2" />{t('availability.addItem')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={`${t('common.search')}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder={t('common.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('common.period')}:</span>
          <DatePickerButton value={fromDate} onChange={(d) => d && setFromDate(d)} placeholder={t('common.fromDate')} />
          <DatePickerButton value={toDate} onChange={(d) => d && setToDate(d)} placeholder={t('common.toDate')} />
        </div>
      </div>

      {/* Table */}
      {summary === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[t('availability.columns.sku'), t('availability.columns.name'), t('availability.columns.category'), t('availability.columns.unit'), t('availability.columns.purchase'), t('availability.columns.sales'), t('availability.columns.transfer'), t('availability.columns.adjustment'), t('availability.columns.production'), t('availability.columns.waste'), t('availability.columns.qtyAkhir'), ''].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <PackageIcon className="size-10 opacity-30" />
          <p className="text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('availability.columns.sku')}</TableHead>
                <TableHead>{t('availability.columns.name')}</TableHead>
                <TableHead>{t('availability.columns.category')}</TableHead>
                <TableHead>{t('availability.columns.unit')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.purchase')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.sales')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.transfer')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.adjustment')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.production')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.waste')}</TableHead>
                <TableHead className="text-right">{t('availability.columns.qtyAkhir')}</TableHead>
                {(canEdit || canDelete) && <TableHead className="w-28 text-right">{t('common.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => {
                const isLow = p.qty > 0 && p.qty <= p.reorderLevel
                const isOut = p.qty === 0
                return (
                  <TableRow
                    key={p._id}
                    className={isOut ? 'bg-destructive/5' : isLow ? 'bg-amber-500/5' : undefined}
                  >
                    <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={p.totalPurchased ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={-(p.totalSold ?? 0)} positiveGreen={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={p.totalTransfer ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={p.totalAdjustment ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={p.totalProduction ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MovementCell value={-(p.totalWaste ?? 0)} positiveGreen={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge qty={p.qty} reorderLevel={p.reorderLevel} />
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="size-8" title={t('availability.stockMovement')} onClick={() => setAdjustTarget(p as Product)}>
                              <SlidersHorizontalIcon className="size-3.5" /><span className="sr-only">{t('availability.stockMovement')}</span>
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditProduct(p as Product)}>
                              <PencilIcon className="size-3.5" /><span className="sr-only">{t('common.edit')}</span>
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p as Product)}>
                              <Trash2Icon className="size-3.5" /><span className="sr-only">{t('common.delete')}</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{t('common.showing', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}</p>
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

      {/* Dialogs */}
      <AddProductDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <EditProductDialog product={editProduct} onClose={() => setEditProduct(null)} />
      <DeleteProductDialog product={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <AdjustStockDialog product={adjustTarget} onClose={() => setAdjustTarget(null)} />
    </div>
  )
}
