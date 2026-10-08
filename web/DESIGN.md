# ContractOS Design System 2.0

Calm, dense, trustworthy. Built for Puerto Rico landlords working from a phone as often as a laptop.
Light and dark themes are equal citizens; the user picks Claro / Oscuro / Sistema in Perfil.

Source of truth: `app/globals.css` (tokens) and `components/ui` + `components/app` (components).

## Rules

1. **Colors only through tokens.** No hex, rgb or `style={{…}}` in `app/` or `components/`
   (ESLint `no-restricted-syntax` errors on them). Allow-listed: `components/ui/**` (vendored
   shadcn), chart and map components, `ContractPDF.tsx`, OG images.
2. **Status is never color alone.** Use `StatusBadge` (icon + text).
3. **Every input has a `<Label>`; icon-only buttons have `aria-label`.**
4. **Phone first.** Everything works at 390px. Lists use `DataTable` with `mobileRow`; forms use `FormSheet`.
5. **Spanish first.** Every string comes from `messages/<locale>/<namespace>.json` (both `es` and `en`).
6. **No decoration.** No glow, blur, gradients, glass or 3D scenes.

## Tokens

Defined for `:root` (light) and `.dark`, exposed as Tailwind utilities via `@theme inline`.

| Role | Utility | Light | Dark |
|---|---|---|---|
| Page background | `bg-background` | #f6f7f9 | #0b0f14 |
| Card / surface | `bg-surface` | #ffffff | #11161d |
| Muted surface | `bg-surface-muted` | #f0f2f5 | #18202a |
| Hover | `bg-surface-hover` | #e9ecf1 | #1f2935 |
| Text | `text-foreground` | #0f172a | #e6eaf0 |
| Secondary text | `text-muted-foreground` | #475569 | #a7b1c0 |
| Tertiary text | `text-subtle-foreground` | #556070 | #8b96a6 |
| Border | `border-border` / `border-border-strong` | #e2e6ec / #cbd2dc | #243041 / #334155 |
| Primary | `bg-primary text-primary-foreground` | #0f766e | #2dd4bf |
| Primary soft | `bg-primary-soft text-primary-soft-foreground` | #e6f4f2 / #0f5f58 | #0f2e2c / #7ee8d8 |
| Success / warning / danger / info | `text-success` + `bg-success-soft` … | | |
| Charts | `var(--chart-1…5)` | teal, blue, amber, violet, pink | lighter variants |

Every text/background pairing above is ≥ 4.5:1 (checked by axe in CI on 6 key screens, both themes).

Radius `--radius` 0.625rem (`rounded-md`, `rounded-lg`, `rounded-xl`). Shadows: `shadow-sm`, `shadow-md` only.
Motion: 150 / 200 / 250 ms with `--ease-standard`; `prefers-reduced-motion` disables animation.

## Type

Inter everywhere (`--font-inter`). Body 16px on phones, 14px on desktop (≥ 1024px). Nothing below 12px.
Page title: `PageHeader` (text-2xl semibold). Section title: text-base/lg semibold.
Money and figures: add `tabular` (tabular numerals).

## Formatting

next-intl formatter with locale `es-US` / `en-US` (set in `i18n/request.ts`):
`f.number(x, "money")` → `$1,150`; `f.dateTime(d, { dateStyle: "medium" })` → `12 dic 2026`.
Date-only strings: `new Date(d + "T12:00:00")` so they never shift a day. Time zone America/Puerto_Rico.

## Components

| Need | Use |
|---|---|
| Screen title + actions | `components/app/PageHeader` |
| Lists | `components/app/DataTable` (search, facets, sorting, saved views, CSV, mobile cards) |
| Create / edit | `components/app/FormSheet` (right sheet desktop, full screen phone) |
| Status | `components/app/StatusBadge` |
| Empty list | `components/app/EmptyState` (one primary action) |
| Feedback | `toast` from `sonner` (Toaster lives in the app shell) |
| Confirm destructive action | `Dialog` with a danger button |
| Primitives | `components/ui/*` (shadcn v4 on radix-ui) |

## App shell

`components/shell/AppShell`: grouped sidebar (Gestión · Análisis · Cuenta), ⌘K command palette,
notification bell (`lib/alerts.ts`), phone tab bar (Inicio, Contratos, Propiedades, Inquilinos, Más).

## Testing the look

`node e2e/mock/server.mjs` + a build with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399`
renders signed-in screens with demo data. `npm run e2e` runs page checks and axe in light and dark.
