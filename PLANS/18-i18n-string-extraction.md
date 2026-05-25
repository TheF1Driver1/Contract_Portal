# Plan 18 — i18n String Extraction & Language Switcher

**Branch:** `feature/i18n-strings` (off `feature/pr-expansion` or `dev` once merged)

---

## What's already done (no work needed)

The full infrastructure was shipped on `feature/pr-expansion`:

- `next-intl` v4 installed and configured
- `web/i18n/request.ts` — reads `NEXT_LOCALE` cookie, defaults to `'es'`
- `web/next.config.mjs` — wrapped with `withNextIntl`
- `web/app/layout.tsx` — `<html lang={locale}>` + `<NextIntlClientProvider messages={messages}>`
- `web/middleware.ts` — syncs `profiles.locale` → `NEXT_LOCALE` cookie on every authenticated request
- `web/messages/es.json` + `web/messages/en.json` — full translation dictionaries for all namespaces: `nav`, `auth`, `dashboard`, `contracts`, `properties`, `tenants`, `expenses`, `settings`, `billing`, `pricing`, `common`
- `profiles.locale` DB column exists (default `'es'`)

Toggling the locale (cookie + DB) already works correctly — `html lang` and the loaded message bundle both update. The only missing piece is that **no component reads from the bundle yet**.

---

## What needs to be built

### 1. Language switcher UI

A simple `ES | EN` toggle, placed in **Settings → General** (not the sidebar — avoids cluttering the nav chrome).

**API route** — `POST /api/locale`
```ts
// validates 'es' | 'en'
// updates profiles.locale in Supabase
// sets NEXT_LOCALE cookie in response (1-year, sameSite: lax)
// returns { ok: true }
```

**UI** — two pill buttons in `/settings` or `/profile`, calling the API then `router.refresh()`.

The optimistic + refresh pattern was already prototyped and tested — it works correctly. Restore from git history if needed (`ff567bd`).

---

### 2. String extraction — component by component

Replace hardcoded strings with `t('key')` calls. Work through surfaces in order of user visibility:

#### Sidebar (`components/Sidebar.tsx`)
```tsx
const t = useTranslations('nav');
// "Dashboard" → t('dashboard')   "Panel"
// "Contracts" → t('contracts')   "Contratos"
// "Properties" → t('properties') "Propiedades"
// "Tenants" → t('tenants')       "Arrendatarios"
// "Expenses" → t('expenses')     "Gastos"
// "Market" → t('market')         "Mercado"
// "Watchlist" → t('watchlist')   "Lista de Seguimiento"
// "Billing" → t('billing')       key missing — add to nav namespace
// "Sign out" → t('signOut')      "Cerrar sesión"
// "Navigation" → t('navigation') "Navegación"
```

#### Dashboard page (`app/(dashboard)/dashboard/page.tsx`)
Keys: `dashboard.title`, `dashboard.monthlyRevenue`, `dashboard.activeLeases`, `dashboard.properties`, `dashboard.tenants`, `dashboard.expiringLeases`, `dashboard.viewAll`

#### Expenses page (`app/(dashboard)/expenses/page.tsx`)
Keys: `expenses.title`, `expenses.new`, `expenses.categories.*`, `expenses.exportCSV`
Category labels map 1:1 with `es.json` `expenses.categories` — replace `CATEGORY_LABELS` record.

#### Contracts page
Keys: `contracts.title`, `contracts.new`, `contracts.status.*`, `contracts.type.*`

#### Properties, Tenants pages
Keys: `properties.title`, `properties.new`, `properties.noProperties`, `tenants.title`, `tenants.new`

#### Settings/Billing page
Keys: `billing.title`, `billing.currentPlan`, `billing.upgrade`, `billing.manage`, `billing.plans.*`, `billing.features.*`

#### Pricing page
Keys: `pricing.title`, `pricing.subtitle`, `pricing.getStarted`, `pricing.mostPopular`

#### Common UI (buttons, toasts, modals)
Keys: `common.save`, `common.cancel`, `common.delete`, `common.edit`, `common.send`, `common.loading`, `common.error`, `common.back`, `common.next`

---

### 3. Missing translation keys to add before starting

A few keys referenced above are absent from both JSON files:

| Namespace | Key | ES value | EN value |
|---|---|---|---|
| `nav` | `billing` | `"Facturación"` | `"Billing"` |
| `nav` | `scheduleE` | `"Schedule E"` | `"Schedule E"` |
| `dashboard` | `expiringTitle` | `"Por vencer"` | `"Expiring Soon"` |
| `dashboard` | `recentContracts` | `"Contratos recientes"` | `"Recent Contracts"` |
| `expenses` | `totalExpenses` | `"Total gastos"` | `"Total Expenses"` |
| `expenses` | `taxDeductible` | `"Deducible"` | `"Tax Deductible"` |
| `expenses` | `transactions` | `"Transacciones"` | `"Transactions"` |
| `expenses` | `byCategory` | `"Por categoría"` | `"By Category"` |

---

## Recommended execution order

1. Add missing JSON keys
2. Build `/api/locale` route + settings UI toggle
3. Sidebar (high visibility, proves end-to-end)
4. Dashboard page
5. Expenses page
6. Contracts, Properties, Tenants pages
7. Settings/Billing, Pricing pages
8. Common components (modals, buttons, toasts)

---

## Notes

- Server components use `getTranslations('namespace')` (async, from `next-intl/server`)
- Client components use `useTranslations('namespace')` (hook)
- `'use client'` components wrapped in `NextIntlClientProvider` in `layout.tsx` can call the hook directly — no extra setup needed
- Most dashboard pages are server components; their child modals/buttons are client components — extract both separately
- Do NOT extract strings from ContractBuilder compliance/legal text — those are PR-specific legal copy, not UI chrome
