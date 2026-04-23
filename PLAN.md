# ContractOS — Feature Index

## Stack
- Next.js 14.2, React 18, TypeScript
- Supabase JS v2, project `worpdncyiozjfbguxukb`
- TailwindCSS + shadcn/ui + lucide-react
- Zillow data in `rea.zillow_unique` (1454 rows, migrated 2026-04-19)

## Packages Installed
```bash
cd Contract_Portal/web
npm install next-themes recharts @react-pdf/renderer leaflet react-leaflet
npm install -D @types/leaflet
```

## Feature Status
| # | Feature | Status | Plan File |
|---|---------|--------|-----------|
| 1 | Dark Mode | ✅ DONE | `PLANS/01-dark-mode.md` |
| 2 | Mobile Responsive | ✅ DONE | `PLANS/02-mobile.md` |
| 3 | Email Enhancement | ✅ DONE | `PLANS/03-email.md` |
| 4 | DOCX Fix + PDF | ✅ DONE | `PLANS/04-docx-pdf.md` |
| 5 | Cashflow Graph | ✅ DONE | `PLANS/05-cashflow.md` |
| 6 | Property Map | ✅ DONE | `PLANS/06-property-map.md` |
| 7 | Market Feature (map) | ✅ DONE | `PLANS/07-market.md` |
| 8 | Market List View + Detail | ✅ DONE | `PLANS/08-market-list.md` |
| 9 | Market Analytics Widget | ✅ DONE | `PLANS/09-market-analytics.md` |
| 10 | Saved Properties / Watchlist | ✅ DONE | `PLANS/10-watchlist.md` |
| 11 | Rent vs Market Comparison | ✅ DONE | `PLANS/11-rent-vs-market.md` |
| 12 | Scraper Scheduler (cron) | ✅ DONE | `PLANS/12-scraper-cron.md` |
| 13 | Apple-style UI Redesign (Stitch) | ✅ DONE | `PLANS/13-ui-redesign.md` |

## Supabase
| Schema | Tables |
|--------|--------|
| `public` | contracts, tenants, properties, profiles |
| `rea` | zillow_unique, zillow_historical |

Both schemas in same project `worpdncyiozjfbguxukb`. Python scraper writes to `rea`.

## Instructions for Local LLM
1. Read one PLANS/ file at a time
2. Read only files that plan says to modify
3. Make changes, mark feature ✅ DONE in this file and HANDOFF.md
4. Move to next feature
