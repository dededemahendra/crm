import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  PlusIcon, CalendarIcon, ReceiptIcon, XIcon,
  PencilIcon, Trash2Icon, ChevronLeftIcon, ChevronRightIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_protected/expenses')({
  component: ExpensesPage,
})

const PAGE_SIZE = 20

const DEFAULT_CATEGORIES = [
  'Utilities', 'Rent', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other',
]

const PAYMENT_METHOD_KEYS = ['cash', 'bank_transfer', 'credit', 'qris'] as const
type PaymentMethod = (typeof PAYMENT_METHOD_KEYS)[number]

const expenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().min(0.01, 'Must be > 0'),
  description: z.string().min(1, 'Description is required'),
  date: z.date(),
  supplier: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'credit', 'qris']).optional(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>
type Role = 'admin' | 'manager' | 'viewer'

type ExpenseRecord = {
  _id: Id<'operatingExpenses'>
  category: string
  amount: number
  description: string
  date: number
  supplier?: string
  paymentMethod?: string
}

function fmtNumber(n: number) { return n.toLocaleString() }

function DatePickerButton({
  value, onChange, placeholder,
}: { value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string }) {
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

function PaymentBadge({ method }: { method?: string | null }) {
  const { t } = useTranslation()
  if (!method) return <span className="text-muted-foreground">—</span>
  const label = PAYMENT_METHOD_KEYS.includes(method as PaymentMethod)
    ? t(`payment.${method}`)
    : method
  return <Badge variant="outline" className="text-xs">{label}</Badge>
}


// ─── Expense Sheet (add + edit) ───────────────────────────────────────────────

function ExpenseSheet({
  open,
  onClose,
  editItem,
  categories,
  supplierSuggestions,
}: {
  open: boolean
  onClose: () => void
  editItem: ExpenseRecord | null
  categories: string[]
  supplierSuggestions: string[]
}) {
  const { t } = useTranslation()
  const createOpEx = useMutation(api.expenses.createOpEx)
  const updateOpEx = useMutation(api.expenses.updateOpEx)

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: { category: '', amount: 0, description: '', date: new Date(), supplier: '', paymentMethod: undefined },
  })

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.reset({
          category: editItem.category,
          amount: editItem.amount,
          description: editItem.description,
          date: new Date(editItem.date),
          supplier: editItem.supplier ?? '',
          paymentMethod: (editItem.paymentMethod as ExpenseFormData['paymentMethod']) ?? undefined,
        })
      } else {
        form.reset({ category: '', amount: 0, description: '', date: new Date(), supplier: '', paymentMethod: undefined })
      }
    }
  }, [open, editItem])

  async function onSubmit(data: ExpenseFormData) {
    try {
      const payload = {
        ...data,
        date: data.date.getTime(),
        supplier: data.supplier?.trim() || undefined,
        paymentMethod: data.paymentMethod,
      }
      if (editItem) {
        await updateOpEx({ id: editItem._id, ...payload })
        toast.success('Expense updated')
      } else {
        await createOpEx(payload)
        toast.success('Expense recorded')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    }
  }

  const isEdit = !!editItem

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEdit ? t('expenses.edit') : t('expenses.add')}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update the expense record.' : 'Record an operating expense.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="flex flex-col gap-4 flex-1 px-4 py-4">
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.columns.category')}</FormLabel>
                <FormControl>
                  <Input placeholder={categories.slice(0, 3).join(', ') + '…'} list="expense-categories" {...field} />
                </FormControl>
                <datalist id="expense-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.columns.amount')}</FormLabel>
                <FormControl><Input type="number" min={0} step="any" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.columns.description')}</FormLabel>
                <FormControl><Input placeholder="Brief description…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.columns.date')}</FormLabel>
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
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => d > new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            {/* Supplier autocomplete via datalist */}
            <FormField control={form.control} name="supplier" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.supplier')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span></FormLabel>
                <FormControl>
                  <Input
                    placeholder="Type or pick a supplier…"
                    list="expense-suppliers"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <datalist id="expense-suppliers">
                  {supplierSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
                <FormMessage />
              </FormItem>
            )} />

            {/* Payment Method */}
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('expenses.paymentMethod')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span></FormLabel>
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
            )} />

            <SheetFooter className="mt-auto pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('common.saving') : isEdit ? t('common.save') : t('expenses.add')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteExpenseDialog({ item, onClose }: { item: ExpenseRecord | null; onClose: () => void }) {
  const { t } = useTranslation()
  const deleteOpEx = useMutation(api.expenses.deleteOpEx)
  const [isPending, setIsPending] = useState(false)

  async function handleDelete() {
    if (!item) return
    setIsPending(true)
    try {
      await deleteOpEx({ id: item._id })
      toast.success('Expense deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t('expenses.deleteItem')}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('expenses.deleteConfirm', { name: item?.description ?? '' })}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExpensesPage() {
  const { t } = useTranslation()
  const expenses = useQuery(api.expenses.listOpEx)
  const profile = useQuery(api.users.getMyProfile)
  const appSettings = useQuery(api.settings.getSettings)
  const supplierSuggestions = useQuery(api.expenses.getSupplierSuggestions) ?? []
  const role: Role = profile?.role ?? 'viewer'
  const categories =
    appSettings?.expenseCategories && appSettings.expenseCategories.length > 0
      ? appSettings.expenseCategories
      : DEFAULT_CATEGORIES

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<ExpenseRecord | null>(null)
  const [deleteItem, setDeleteItem] = useState<ExpenseRecord | null>(null)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [page, setPage] = useState(0)

  const hasFilters = !!search || !!fromDate || !!toDate

  const filtered = useMemo(() => {
    if (!expenses) return []
    return expenses.filter((e) => {
      if (search &&
        !e.description.toLowerCase().includes(search.toLowerCase()) &&
        !e.category.toLowerCase().includes(search.toLowerCase()) &&
        !(e.supplier ?? '').toLowerCase().includes(search.toLowerCase())
      ) return false
      if (fromDate && e.date < startOfDay(fromDate).getTime()) return false
      if (toDate && e.date > endOfDay(toDate).getTime()) return false
      return true
    })
  }, [expenses, search, fromDate, toDate])

  useEffect(() => { setPage(0) }, [search, fromDate, toDate])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered])
  const canEdit = role === 'admin' || role === 'manager'

  function openAdd() { setEditItem(null); setSheetOpen(true) }
  function openEdit(item: ExpenseRecord) { setEditItem(item); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setEditItem(null) }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('expenses.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {expenses !== undefined ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}` : t('common.loading')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />{t('expenses.add')}
          </Button>
        )}
      </div>

      {expenses !== undefined && (
        <div className="rounded-lg border p-4 w-fit">
          <p className="text-sm text-muted-foreground">{t('expenses.totalFiltered')}</p>
          <p className="text-xl font-bold tabular-nums mt-1">{fmtNumber(total)}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder={`${t('common.search')}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <DatePickerButton value={fromDate} onChange={setFromDate} placeholder={t('common.fromDate')} />
        <DatePickerButton value={toDate} onChange={setToDate} placeholder={t('common.toDate')} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFromDate(undefined); setToDate(undefined) }} className="gap-1.5 text-muted-foreground">
            <XIcon className="size-3.5" />{t('common.clearFilters')}
          </Button>
        )}
      </div>

      {expenses === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow>{[t('expenses.columns.date'), t('expenses.columns.category'), t('expenses.columns.description'), t('expenses.columns.supplier'), t('expenses.columns.payment'), t('expenses.columns.amount'), ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ReceiptIcon className="size-10 opacity-30" />
          <p className="text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('expenses.columns.date')}</TableHead>
                  <TableHead>{t('expenses.columns.category')}</TableHead>
                  <TableHead>{t('expenses.columns.description')}</TableHead>
                  <TableHead>{t('expenses.columns.supplier')}</TableHead>
                  <TableHead>{t('expenses.columns.payment')}</TableHead>
                  <TableHead className="text-right">{t('expenses.columns.amount')}</TableHead>
                  {canEdit && <TableHead className="w-20 text-right">{t('common.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(e.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{e.supplier ?? '—'}</TableCell>
                    <TableCell><PaymentBadge method={e.paymentMethod} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtNumber(e.amount)}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e as ExpenseRecord)}>
                            <PencilIcon className="size-3.5" /><span className="sr-only">{t('common.edit')}</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteItem(e as ExpenseRecord)}>
                            <Trash2Icon className="size-3.5" /><span className="sr-only">{t('common.delete')}</span>
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
        </>
      )}

      <ExpenseSheet
        open={sheetOpen}
        onClose={closeSheet}
        editItem={editItem}
        categories={categories}
        supplierSuggestions={supplierSuggestions}
      />
      <DeleteExpenseDialog item={deleteItem} onClose={() => setDeleteItem(null)} />
    </div>
  )
}
