# Feature 13 — Apple-style UI Redesign (Stitch)

## Goal
Transform ContractOS from generic shadcn/ui to a premium minimalist Apple-style SaaS.
Design source: Google Stitch project `14096212677773735696` "Minimalist Landlord Dashboard".

## Design System (from Stitch)
| Token | Value |
|-------|-------|
| Surface base | `#f9f9fe` |
| Surface container | `#ebeef7` |
| Surface card | `#ffffff` |
| Accent blue | `#007AFF` |
| Accent deep blue | `#005bc2` |
| Text primary | `#2c333d` |
| Text secondary | `#595f6a` |
| Error | `#9f403d` |
| Radius | `8px` |
| Font | Inter / -apple-system |

## Rules (from Stitch design doc)
- **No borders** — tonal layering only (`surface-container` backgrounds, not `border`)
- **No pure black** — use `#2c333d` for text
- **Glassmorphism** — `backdrop-blur-xl` + 80% opacity for floating elements
- **Shadows** — single ambient: `0 12px 40px rgba(44,51,61,0.06)`
- **Animations** — ease-out-expo 300ms for all transitions
- **Hover** — background shift (not movement), `surface-bright` on hover
- **Status pills** — full rounded, blue=active, red=expired, no borders

## Files Changed
| File | Change |
|------|--------|
| `web/tailwind.config.ts` | Add Stitch color tokens + animation keyframes |
| `web/app/globals.css` | New CSS vars, glass utility, animation keyframes, custom scrollbar |
| `web/components/Sidebar.tsx` | Slim glassmorphism sidebar, icon+label, blue active glow |
| `web/app/(auth)/login/page.tsx` | Split layout: animated gradient left, clean card right |
| `web/app/(dashboard)/dashboard/page.tsx` | Editorial layout: oversized KPIs, tonal cards, no borders |
| `web/components/CashflowChart.tsx` | Minimal blue area chart |

## Stitch Screens (existing)
- Dashboard Desktop: `screens/dff87c0a90e94ac0a7f21c38a4374b3d`
- Dashboard Mobile: `screens/5cab5f4f2c914f3cbf4cac5cac791251`
- Contracts Desktop: `screens/4c4de9254d01436b84cdc1374473d778`
- Properties Desktop: `screens/3e666259422e4335b438df46b5112666`
- Contract Builder Step 1: `screens/921f5ab95a044c72ba39bd3d054b529f`
- Contract Builder Finalize: `screens/0947fb2c244d4893b26170a24ea20e77`

## Status
- [x] PLAN.md updated
- [x] This plan file created
- [ ] tailwind.config.ts — add Stitch tokens
- [ ] globals.css — animations + glass utilities
- [ ] Sidebar.tsx redesign
- [ ] Login page redesign
- [ ] Dashboard page redesign
- [ ] CashflowChart minimal redesign
