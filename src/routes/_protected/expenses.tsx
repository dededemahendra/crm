import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfDay, endOfDay } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_protected/expenses')({
  component: ExpensesPage,
})

const PAGE_SIZE = 20

const DEFAULT_CATEGORIES = [
  'Utilities', 'Rent', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other',
]

const expenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().min(0.01, 'Must be > 0'),
  description: z.string().min(1, 'Description is required'),
  date: z.date(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>
type Role = 'admin' | 'manager' | 'viewer'

type ExpenseRecord = {
  _id: Id<'operatingExpenses'>
  category: string
  amount: number
  description: string
  date: number
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

// ─── Expense Sheet (add + edit) ───────────────────────────────────────────────

function ExpenseSheet({
  open,
  onClose,
  editItem,
  categories,
}: {
  open: boolean
  onClose: () => void
  editItem: ExpenseRecord | null
  categories: string[]
}) {
  const createOpEx = useMutation(api.expenses.createOpEx)
  const updateOpEx = useMutation(api.expenses.updateOpEx)

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: { category: '', amount: 0, description: '', date: new Date() },
  })

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.reset({
          category: editItem.category,
          amount: editItem.amount,
          description: editItem.description,
          date: new Date(editItem.date),
        })
      } else {
        form.reset({ category: '', amount: 0, description: '', date: new Date() })
      }
    }
  }, [open, editItem])

  async function onSubmit(data: ExpenseFormData) {
    try {
      if (editItem) {
        await updateOpEx({ id: editItem._id, ...data, date: data.date.getTime() })
        toast.success('Expense updated')
      } else {
        await createOpEx({ ...data, date: data.date.getTime() })
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
          <SheetTitle>{isEdit ? 'Edit Expense' : 'Add Expense'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update the expense record.' : 'Record an operating expense.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="flex flex-col gap-4 flex-1 px-4 py-4">
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
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
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" min={0} step="any" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="Brief description…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
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
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => d > new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            <SheetFooter className="mt-auto pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteExpenseDialog({
  item,
  onClose,
}: {
  item: ExpenseRecord | null
  onClose: () => void
}) {
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
        <DialogHeader>
          <DialogTitle>Delete Expense</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete{' '}
          <span className="font-semibold text-foreground">{item?.description}</span>
          ? This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExpensesPage() {
  const expenses = useQuery(api.expenses.listOpEx)
  const profile = useQuery(api.users.getMyProfile)
  const appSettings = useQuery(api.settings.getSettings)
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
      if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.category.toLowerCase().includes(search.toLowerCase())) return false
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

  function openAdd() {
    setEditItem(null)
    setSheetOpen(true)
  }

  function openEdit(item: ExpenseRecord) {
    setEditItem(item)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditItem(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {expenses !== undefined ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="shrink-0">
            <PlusIcon className="size-4 mr-2" />Add Expense
          </Button>
        )}
      </div>

      {expenses !== undefined && (
        <div className="rounded-lg border p-4 w-fit">
          <p className="text-sm text-muted-foreground">Total (filtered)</p>
          <p className="text-xl font-bold tabular-nums mt-1">{fmtNumber(total)}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search description or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <DatePickerButton value={fromDate} onChange={setFromDate} placeholder="From date" />
        <DatePickerButton value={toDate} onChange={setToDate} placeholder="To date" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFromDate(undefined); setToDate(undefined) }} className="gap-1.5 text-muted-foreground">
            <XIcon className="size-3.5" />Clear filters
          </Button>
        )}
      </div>

      {expenses === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow>{['Date', 'Category', 'Description', 'Amount', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ReceiptIcon className="size-10 opacity-30" />
          <p className="text-sm">{hasFilters ? 'No expenses match your filters' : 'No expenses recorded yet'}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
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
                    <TableCell className="text-right tabular-nums font-medium">{fmtNumber(e.amount)}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e as ExpenseRecord)}>
                            <PencilIcon className="size-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteItem(e as ExpenseRecord)}>
                            <Trash2Icon className="size-3.5" />
                            <span className="sr-only">Delete</span>
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
        </>
      )}

      <ExpenseSheet
        open={sheetOpen}
        onClose={closeSheet}
        editItem={editItem}
        categories={categories}
      />
      <DeleteExpenseDialog item={deleteItem} onClose={() => setDeleteItem(null)} />
    </div>
  )
}
