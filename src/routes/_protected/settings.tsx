import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { format } from 'date-fns'
import { ShieldAlertIcon, CheckIcon, CopyIcon, PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_protected/settings')({
  component: SettingsPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'admin' | 'manager' | 'viewer'

type User = {
  _id: Id<'users'>
  name: string
  email: string
  role: Role
  createdAt: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<Role, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  manager: 'secondary',
  viewer: 'outline',
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
}

// ─── Change Role Dialog ───────────────────────────────────────────────────────

function ChangeRoleDialog({
  user,
  onClose,
}: {
  user: User | null
  onClose: () => void
}) {
  const updateUserRole = useMutation(api.users.updateUserRole)
  const [selectedRole, setSelectedRole] = useState<Role | ''>('')
  const [isPending, setIsPending] = useState(false)

  // sync role when user changes
  const currentRole = user?.role ?? 'viewer'
  const effectiveRole = (selectedRole || currentRole) as Role

  async function handleSave() {
    if (!user || !selectedRole || selectedRole === user.role) return
    setIsPending(true)
    try {
      await updateUserRole({ userId: user._id, role: selectedRole })
      toast.success(`${user.name}'s role updated to ${ROLE_LABELS[selectedRole]}`)
      setSelectedRole('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setIsPending(false)
    }
  }

  function handleClose() {
    setSelectedRole('')
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update the access level for{' '}
            <span className="font-semibold text-foreground">{user?.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            value={effectiveRole}
            onValueChange={(v) => setSelectedRole(v as Role)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <div>
                  <div className="font-medium">Admin</div>
                  <div className="text-xs text-muted-foreground">Full access including user management</div>
                </div>
              </SelectItem>
              <SelectItem value="manager">
                <div>
                  <div className="font-medium">Manager</div>
                  <div className="text-xs text-muted-foreground">Can record purchases, sales, expenses</div>
                </div>
              </SelectItem>
              <SelectItem value="viewer">
                <div>
                  <div className="font-medium">Viewer</div>
                  <div className="text-xs text-muted-foreground">Read-only access to products and reports</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={isPending || !selectedRole || selectedRole === user?.role}
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Register Link ────────────────────────────────────────────────────────────

function RegisterLink() {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/register`
    : '/register'

  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium">Invite Team Members</p>
      <p className="text-sm text-muted-foreground">
        Share this link so new members can create an account. New accounts start as{' '}
        <span className="font-medium text-foreground">Viewer</span> — you can
        change their role after they sign up.
      </p>
      <div className="flex items-center gap-2 mt-3">
        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">
          {url}
        </code>
        <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5">
          {copied ? (
            <><CheckIcon className="size-3.5" />Copied</>
          ) : (
            <><CopyIcon className="size-3.5" />Copy</>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ myId }: { myId: Id<'users'> }) {
  const users = useQuery(api.users.listUsers)
  const [editUser, setEditUser] = useState<User | null>(null)

  return (
    <div className="space-y-6">
      <RegisterLink />

      {users === undefined ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {['Name', 'Email', 'Role', 'Joined', ''].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isMe = u._id === myId
                return (
                  <TableRow key={u._id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {isMe && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE[u.role as Role]}>
                        {ROLE_LABELS[u.role as Role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.createdAt), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isMe && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditUser(u as User)}
                        >
                          Change Role
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ChangeRoleDialog user={editUser} onClose={() => setEditUser(null)} />
    </div>
  )
}

// ─── Role Permissions Reference ───────────────────────────────────────────────

function PermissionsReference() {
  const rows = [
    { feature: 'View Products & Reports', admin: true, manager: true, viewer: true },
    { feature: 'Record Purchases', admin: true, manager: true, viewer: false },
    { feature: 'Record Sales', admin: true, manager: true, viewer: false },
    { feature: 'Record Expenses & Income', admin: true, manager: true, viewer: false },
    { feature: 'Add / Edit Products', admin: true, manager: true, viewer: false },
    { feature: 'Delete Products', admin: true, manager: false, viewer: false },
    { feature: 'Void Sales', admin: true, manager: true, viewer: false },
    { feature: 'Manage Users & Roles', admin: true, manager: false, viewer: false },
  ]

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 border-b">
        <h3 className="font-semibold text-sm">Role Permissions</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead className="text-center">Admin</TableHead>
            <TableHead className="text-center">Manager</TableHead>
            <TableHead className="text-center">Viewer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.feature}>
              <TableCell className="text-sm">{row.feature}</TableCell>
              {(['admin', 'manager', 'viewer'] as const).map((role) => (
                <TableCell key={role} className="text-center">
                  {row[role] ? (
                    <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Thresholds Tab ───────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  'Utilities', 'Rent', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other',
]

function ThresholdsTab() {
  const settings = useQuery(api.settings.getSettings)
  const upsertSettings = useMutation(api.settings.upsertSettings)

  // Tax rate
  const [taxRateInput, setTaxRateInput] = useState('')
  const [savingTax, setSavingTax] = useState(false)

  // Expense categories
  const [newCategory, setNewCategory] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const isLoading = settings === undefined
  const taxRate = settings?.taxRate ?? 0
  const categories =
    settings?.expenseCategories && settings.expenseCategories.length > 0
      ? settings.expenseCategories
      : DEFAULT_CATEGORIES

  async function handleSaveTax() {
    const val = parseFloat(taxRateInput)
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Tax rate must be between 0 and 100')
      return
    }
    setSavingTax(true)
    try {
      await upsertSettings({ taxRate: val })
      toast.success('Tax rate saved')
      setTaxRateInput('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingTax(false)
    }
  }

  async function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    if (categories.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    setSavingCat(true)
    try {
      await upsertSettings({ expenseCategories: [...categories, trimmed] })
      toast.success('Category added')
      setNewCategory('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingCat(false)
    }
  }

  async function handleRemoveCategory(cat: string) {
    const next = categories.filter((c) => c !== cat)
    try {
      await upsertSettings({ expenseCategories: next })
      toast.success(`"${cat}" removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleResetCategories() {
    try {
      await upsertSettings({ expenseCategories: DEFAULT_CATEGORIES })
      toast.success('Categories reset to defaults')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <div className="space-y-6">
      {/* Tax Rate */}
      <div className="rounded-lg border p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Tax Rate</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applied to Profit Before Tax in the P&L report (Net Profit = Profit Before Tax − Tax).
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-48" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative w-36">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder={String(taxRate)}
                value={taxRateInput}
                onChange={(e) => setTaxRateInput(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => void handleSaveTax()}
              disabled={savingTax || taxRateInput === ''}
            >
              {savingTax ? 'Saving…' : 'Save'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Current: <span className="font-medium text-foreground">{taxRate}%</span>
            </span>
          </div>
        )}
      </div>

      {/* Expense Categories */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">Expense Categories</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Categories shown in the expense form datalist.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground shrink-0"
            onClick={() => void handleResetCategories()}
          >
            Reset to defaults
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-muted text-sm"
              >
                <span>{cat}</span>
                <button
                  onClick={() => void handleRemoveCategory(cat)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Remove ${cat}`}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="New category…"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAddCategory()}
            className="max-w-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleAddCategory()}
            disabled={savingCat || !newCategory.trim()}
          >
            <PlusIcon className="size-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const profile = useQuery(api.users.getMyProfile)

  if (profile === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <ShieldAlertIcon className="size-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage users and application configuration.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UsersTab myId={profile._id} />
        </TabsContent>

        <TabsContent value="thresholds" className="mt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure tax rate and expense categories used across the app.
            </p>
            <Separator />
            <ThresholdsTab />
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reference of what each role can access in this application.
            </p>
            <Separator />
            <PermissionsReference />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
