# Cafe CRM — Build Plan

## Current State
- TanStack Start (SSR) + TanStack Router + React 19
- Better Auth set up (email/password only, no roles yet)
- Convex connected (schema has placeholder `todos` + `products` tables)
- shadcn/ui new-york style, Tailwind CSS v4
- Deployed to Netlify

---

## Phase 0 — Foundation Reset
> Clean up starter code and wire up the real schema + auth roles.

- [ ] Replace Convex schema (`convex/schema.ts`) with CRM tables:
      `users`, `products`, `purchases`, `sales`, `operatingExpenses`, `otherIncome`
- [ ] Delete placeholder `convex/todos.ts`
- [ ] Add Better Auth `admin` plugin to `src/lib/auth.ts` (roles: admin, manager, viewer)
- [ ] Add `requireRole` helper to `convex/lib/auth.ts`
- [ ] Install missing shadcn components: table, dialog, sheet, badge, card,
      dropdown-menu, form, calendar, date-picker, tabs, separator, tooltip, skeleton

---

## Phase 1 — Auth & Route Protection
> Login, registration, role-aware route guards.

- [ ] Create `/login` page (email + password form)
- [ ] Create `/register` page (admin bootstraps first account)
- [ ] Auth route guard — redirect unauthenticated users to `/login`
- [ ] Role guard component (wrap admin-only pages)
- [ ] Session user displayed in sidebar header (name + role badge)

---

## Phase 2 — App Shell & Navigation
> Persistent layout that wraps all dashboard pages.

- [ ] Sidebar layout with nav links (role-aware visibility)
- [ ] Nav sections:
  - Dashboard (all roles)
  - Stock / Products (all roles: view; admin+manager: add/edit)
  - Purchases (admin + manager)
  - Sales (admin + manager)
  - Expenses (admin + manager)
  - Other Income (admin + manager)
  - Reports / P&L (all roles)
  - Settings / Users (admin only)
- [ ] Mobile-responsive (collapsible sidebar or bottom nav)
- [ ] Dark/light mode toggle (already has CSS vars)

---

## Phase 3 — Stock / Products
> Core inventory management.

- [ ] Products list page (table with search + category filter)
- [ ] Columns: SKU, Name, Category, Unit, Unit Cost, Qty, Reorder Level, Actions
- [ ] Low-stock indicator (qty ≤ reorderLevel highlights row / badge)
- [ ] Add product dialog (admin + manager)
- [ ] Edit product dialog (admin + manager)
- [ ] Delete product confirmation (admin only)
- [ ] Convex functions: `listProducts`, `getProduct`, `createProduct`,
      `updateProduct`, `deleteProduct`

---

## Phase 4 — Purchases
> Record incoming stock from suppliers.

- [ ] Purchases list page (table, filterable by date range + supplier)
- [ ] Record purchase form/sheet:
      Product (select), Qty, Unit Cost, Total Cost (auto), Supplier, Invoice No, Date
- [ ] On submit: update `products.qty` and `products.unitCost`, insert purchase record
- [ ] Convex functions: `listPurchases`, `createPurchase`

---

## Phase 5 — Sales
> Record outgoing sales.

- [ ] Sales list page (table, filterable by date range, with totals)
- [ ] Record sale form/sheet:
      Product (select), Qty, Selling Price, Discount, Date
- [ ] Auto-calculate: COGS, Revenue on server
- [ ] Stock validation (prevent qty > available)
- [ ] Void sale (admin + manager) — restores stock
- [ ] Convex functions: `listSales`, `createSale`, `voidSale`

---

## Phase 6 — Operating Expenses & Other Income
> Track non-COGS costs and non-sales income.

- [ ] OpEx list page + add entry form (category, amount, description, date)
- [ ] Other Income list page + add entry form (source, amount, notes, date)
- [ ] Convex functions: `listOpEx`, `createOpEx`, `listOtherIncome`, `createOtherIncome`

---

## Phase 7 — P&L Dashboard & Reports
> Financial overview and analytics.

- [ ] Dashboard summary cards (Today / This Month / This Year):
      Revenue, COGS, Gross Profit, Operating Income, Net Profit
- [ ] Date range picker for custom period
- [ ] Charts (Recharts or shadcn/ui charts):
      - Revenue vs COGS bar chart (by month)
      - Gross Profit trend line
      - Top-selling products (by revenue)
      - Expense breakdown (pie/donut)
- [ ] P&L detail table (all line items)
- [ ] Export to CSV (all roles)
- [ ] Convex queries: `getPLSummary`, `getSalesByPeriod`, `getTopProducts`

---

## Phase 8 — User Management (Admin Only)
> Manage team members and roles.

- [ ] Users list page (table: name, email, role, joined date)
- [ ] Change role dialog (admin only)
- [ ] Invite user / create user (admin only)
- [ ] Convex functions: `listUsers`, `updateUserRole`

---

## Phase 9 — Settings & Thresholds (Admin Only)
> System configuration.

- [ ] Reorder level editor (update `products.reorderLevel` in bulk or per-product)
- [ ] Tax rate configuration (for Net Profit calculation)
- [ ] Expense categories management

---

## Build Order Summary

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                              ↓
Phase 7 ← Phase 6 ← Phase 5 ←──────────────┘
   ↓
Phase 8 → Phase 9
```

## Tech Notes
- **Routing:** TanStack Router file-based routes under `src/routes/`
- **Auth handler:** Already at `src/routes/api/auth/$.ts`
- **Path aliases:** `@/*` → `src/*`, `#/*` → root (shadcn installs to `#/components/ui/`)
- **Convex auth identity:** `ctx.auth.getUserIdentity()` returns the Better Auth session claims
- **No Next.js** — brief examples are reference only; adapt to TanStack Start patterns
