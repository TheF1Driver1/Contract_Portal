# Task: Mobile Responsiveness

## Files to modify
- `web/components/Sidebar.tsx`
- `web/app/(dashboard)/layout.tsx`
- `web/app/(dashboard)/contracts/page.tsx`
- `web/app/(dashboard)/tenants/page.tsx`
- `web/components/ContractBuilder.tsx`

## Install
None. Tailwind responsive prefixes already available.

## Changes

### `web/components/Sidebar.tsx`
Add state: `const [open, setOpen] = useState(false)`

1. Wrap existing sidebar in `hidden md:flex` so it hides on mobile.

2. Add mobile top bar (above everything):
```tsx
<div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b bg-card flex items-center px-4 justify-between">
  <span className="font-bold">ContractOS</span>
  <button onClick={() => setOpen(true)}><Menu size={22} /></button>
</div>
```

3. Add drawer overlay:
```tsx
{open && (
  <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
    <div className="w-64 h-full bg-card p-4" onClick={e => e.stopPropagation()}>
      {/* same nav links as desktop sidebar */}
    </div>
  </div>
)}
```

4. Add fixed bottom nav:
```tsx
<nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card flex justify-around py-2">
  <Link href="/dashboard"><LayoutDashboard size={20}/><span className="text-xs">Home</span></Link>
  <Link href="/properties"><Building size={20}/><span className="text-xs">Properties</span></Link>
  <Link href="/tenants"><Users size={20}/><span className="text-xs">Tenants</span></Link>
  <Link href="/contracts"><FileText size={20}/><span className="text-xs">Contracts</span></Link>
</nav>
```

### `web/app/(dashboard)/layout.tsx`
- Outer wrapper: add `flex-col md:flex-row`
- `<main>`: add `pt-14 md:pt-0 pb-16 md:pb-0`

### `web/app/(dashboard)/contracts/page.tsx`
Replace table with dual render:
```tsx
{/* desktop */}
<div className="hidden md:block"><table>...</table></div>
{/* mobile */}
<div className="md:hidden space-y-3">
  {contracts.map(c => (
    <div key={c.id} className="bg-card rounded-lg p-4 border">
      <div className="flex justify-between items-center">
        <span className="font-medium">{c.tenant?.name}</span>
        <Badge>{c.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{c.property?.address}</p>
      <p className="text-sm">${c.rent_amount}/mo · {c.lease_start} – {c.lease_end}</p>
    </div>
  ))}
</div>
```

### `web/app/(dashboard)/tenants/page.tsx`
Same pattern as contracts: `hidden md:block` table + `md:hidden` card list.

### `web/components/ContractBuilder.tsx`
- Step bar: on mobile show `<p className="md:hidden text-sm">Step {step} of 5: {stepLabels[step]}</p>` instead of 5 buttons
- Filter badges: add `min-h-[44px]` for touch targets

## Done
- Resize browser to 375px width: top bar + hamburger visible, sidebar gone
- Bottom nav shows 4 tabs
- Contracts/tenants tables replaced with cards on mobile
- No horizontal scroll on mobile
