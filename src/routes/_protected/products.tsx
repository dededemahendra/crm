import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PlusIcon, PencilIcon, Trash2Icon, PackageIcon,
  SlidersHorizontalIcon, ChevronLeftIcon, ChevronRightIcon,
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
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_protected/products')({
  component: ProductsPage,
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  unitCost: z.coerce.number().min(0, 'Must be ≥ 0'),
  qty: z.coerce.number().int('Must be a whole number').min(0, 'Must be ≥ 0'),
  reorderLevel: z.coerce
    .number()
    .int('Must be a whole number')
    .min(0, 'Must be ≥ 0'),
})

type ProductFormData = z.infer<typeof productSchema>

type Product = {
  _id: Id<'products'>
  sku: string
  name: string
  category: string
  unit: string
  unitCost: number
  qty: number
  reorderLevel: number
  updatedAt: number
}

type Role = 'admin' | 'manager' | 'viewer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString()
}

function StockBadge({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  if (qty === 0) {
    return (
      <Badge variant="destructive" className="tabular-nums">
        Out of stock
      </Badge>
    )
  }
  if (qty <= reorderLevel) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600 dark:text-amber-400 tabular-nums"
      >
        Low — {fmtNumber(qty)}
      </Badge>
    )
  }
  return <span className="tabular-nums">{fmtNumber(qty)}</span>
}

// ─── Product Form (shared by Add + Edit) ─────────────────────────────────────

function ProductForm({
  form,
  onSubmit,
  isPending,
  submitLabel,
  onCancel,
}: {
  form: ReturnType<typeof useForm<ProductFormData>>
  onSubmit: (data: ProductFormData) => Promise<void>
  isPending: boolean
  submitLabel: string
  onCancel: () => void
}) {
  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="CF-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Arabica Coffee" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="Coffee, Food, Beverage…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'bottle', 'sachet', 'portion'].map(
                      (u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="unitCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Cost</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="any" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="qty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qty</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={1} placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reorderLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder Level</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={1} placeholder="10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ─── Add Product Dialog ───────────────────────────────────────────────────────

function AddProductDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const createProduct = useMutation(api.products.createProduct)
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      category: '',
      unit: '',
      unitCost: 0,
      qty: 0,
      reorderLevel: 10,
    },
  })

  async function onSubmit(data: ProductFormData) {
    try {
      await createProduct(data)
      toast.success('Product added')
      form.reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add product')
    }
  }

  function handleClose() {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <ProductForm
          form={form}
          onSubmit={onSubmit}
          isPending={form.formState.isSubmitting}
          submitLabel="Add Product"
          onCancel={handleClose}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Product Dialog ──────────────────────────────────────────────────────

function EditProductDialog({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  const updateProduct = useMutation(api.products.updateProduct)
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    values: product
      ? {
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitCost: product.unitCost,
          qty: product.qty,
          reorderLevel: product.reorderLevel,
        }
      : undefined,
  })

  async function onSubmit(data: ProductFormData) {
    if (!product) return
    try {
      await updateProduct({ id: product._id, ...data })
      toast.success('Product updated')
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update product',
      )
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <ProductForm
          form={form}
          onSubmit={onSubmit}
          isPending={form.formState.isSubmitting}
          submitLabel="Save Changes"
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Product Dialog ────────────────────────────────────────────────────

function DeleteProductDialog({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  const deleteProduct = useMutation(api.products.deleteProduct)
  const [isPending, setIsPending] = useState(false)

  async function handleDelete() {
    if (!product) return
    setIsPending(true)
    try {
      await deleteProduct({ id: product._id })
      toast.success('Product deleted')
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete product',
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-foreground">{product?.name}</span>?
          This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Adjust Stock Dialog ──────────────────────────────────────────────────────

function AdjustStockDialog({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  const adjustStock = useMutation(api.products.adjustStock)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (product) {
      setQty(String(product.qty))
      setReason('')
    }
  }, [product])

  async function handleSave() {
    if (!product) return
    const newQty = parseInt(qty, 10)
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantity must be a non-negative number')
      return
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason')
      return
    }
    setIsPending(true)
    try {
      await adjustStock({ id: product._id, qty: newQty, reason: reason.trim() })
      toast.success(`Stock adjusted to ${newQty} ${product.unit}`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust stock')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{product?.name}</p>
            <p className="text-xs text-muted-foreground">
              Current: {product?.qty} {product?.unit}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Quantity</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Spoilage, count correction, damaged…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={isPending}>
            {isPending ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Products Table ───────────────────────────────────────────────────────────

function ProductsTable({
  products,
  role,
  isLoading,
  onEdit,
  onDelete,
  onAdjust,
}: {
  products: Product[]
  role: Role
  isLoading: boolean
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onAdjust: (p: Product) => void
}) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {['SKU', 'Name', 'Category', 'Unit', 'Unit Cost', 'Qty', 'Reorder Level', 'Actions'].map(
                (h) => (
                  <TableHead key={h}>{h}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <PackageIcon className="size-10 opacity-30" />
        <p className="text-sm">No products found</p>
      </div>
    )
  }

  const canEdit = role === 'admin' || role === 'manager'
  const canDelete = role === 'admin'

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Reorder Level</TableHead>
            {(canEdit || canDelete) && (
              <TableHead className="w-32 text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const isLow = p.qty > 0 && p.qty <= p.reorderLevel
            const isOut = p.qty === 0
            return (
              <TableRow
                key={p._id}
                className={
                  isOut
                    ? 'bg-destructive/5'
                    : isLow
                      ? 'bg-amber-500/5'
                      : undefined
                }
              >
                <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNumber(p.unitCost)}
                </TableCell>
                <TableCell className="text-right">
                  <StockBadge qty={p.qty} reorderLevel={p.reorderLevel} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {fmtNumber(p.reorderLevel)}
                </TableCell>
                {(canEdit || canDelete) && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Adjust stock"
                          onClick={() => onAdjust(p)}
                        >
                          <SlidersHorizontalIcon className="size-3.5" />
                          <span className="sr-only">Adjust stock</span>
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onEdit(p)}
                        >
                          <PencilIcon className="size-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(p)}
                        >
                          <Trash2Icon className="size-3.5" />
                          <span className="sr-only">Delete</span>
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
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function ProductsPage() {
  const products = useQuery(api.products.listProducts)
  const profile = useQuery(api.users.getMyProfile)
  const role: Role = profile?.role ?? 'viewer'

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)
  const [page, setPage] = useState(0)

  const categories = useMemo(() => {
    if (!products) return []
    return [...new Set(products.map((p) => p.category))].sort()
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return []
    const q = search.toLowerCase()
    return products.filter((p) => {
      const matchSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      const matchCat =
        categoryFilter === 'all' || p.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [products, search, categoryFilter])

  const lowStockCount = useMemo(
    () =>
      (products ?? []).filter((p) => p.qty <= p.reorderLevel).length,
    [products],
  )

  useEffect(() => { setPage(0) }, [search, categoryFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const canAdd = role === 'admin' || role === 'manager'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {products !== undefined
              ? `${products.length} product${products.length !== 1 ? 's' : ''}${lowStockCount > 0 ? ` · ${lowStockCount} low stock` : ''}`
              : 'Loading…'}
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => setAddOpen(true)} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ProductsTable
        products={products === undefined ? [] : paginated}
        role={role}
        isLoading={products === undefined}
        onEdit={setEditProduct}
        onDelete={setDeleteTarget}
        onAdjust={setAdjustTarget}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon className="size-4 mr-1" />Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next<ChevronRightIcon className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddProductDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditProductDialog
        product={editProduct}
        onClose={() => setEditProduct(null)}
      />
      <DeleteProductDialog
        product={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <AdjustStockDialog
        product={adjustTarget}
        onClose={() => setAdjustTarget(null)}
      />
    </div>
  )
}
