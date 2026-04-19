# ContractOS — Feature Index

## Stack
- Next.js 14.2, React 18, TypeScript
- Supabase JS v2, project `worpdncyiozjfbguxukb`
- TailwindCSS + shadcn/ui + lucide-react

## Install All Packages First
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
| 7 | Market Feature | ✅ DONE | `PLANS/07-market.md` |

## Two Supabase Instances
| Project | ID | Schema |
|---------|----|--------|
| Real-Estate-Search-Automation | `qjqlnpaurdosaiydwvnd` | `REA` |
| Contract_Portal | `worpdncyiozjfbguxukb` | `public` (+ `rea` after Feature 7) |

**Decision:** Feature 7 migrates Python writer to Contract_Portal's Supabase. Single DB.

## Instructions for Local LLM
1. Read one PLANS/ file at a time
2. Read only files that plan says to modify
3. Make changes, mark feature ✅ DONE in this file and HANDOFF.md
4. Move to next feature
