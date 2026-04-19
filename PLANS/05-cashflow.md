# Task: Cashflow Graph

## Files to modify
- `web/app/(dashboard)/dashboard/page.tsx`

## Files to create
- `web/components/CashflowChart.tsx`

## Install
```bash
cd Contract_Portal/web && npm install recharts
```

## Changes

### Create `web/components/CashflowChart.tsx`
```tsx
"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { label: string; income: number }[]
}

export default function CashflowChart({ data }: Props) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```
**Note:** Parent `div` must have fixed height (`h-48`). `ResponsiveContainer` requires it.

### `web/app/(dashboard)/dashboard/page.tsx`
After fetching `activeContracts`, compute cashflow data:
```typescript
const now = new Date()
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    income: 0,
  }
})
activeContracts.forEach((c) => {
  const start = c.lease_start.slice(0, 7)
  const end = c.lease_end.slice(0, 7)
  months.forEach((m) => {
    if (m.key >= start && m.key <= end) m.income += c.rent_amount
  })
})
const cashflowData = months.map(({ label, income }) => ({ label, income }))
```

Add to JSX (only render if any income exists):
```tsx
import CashflowChart from "@/components/CashflowChart"

{cashflowData.some(m => m.income > 0) && (
  <div className="bg-card rounded-xl border p-4">
    <h3 className="font-semibold mb-3">Monthly Income (6 months)</h3>
    <CashflowChart data={cashflowData} />
  </div>
)}
```

## Done
- Dashboard shows bar chart with last 6 months of projected income
- Bars use primary color; grid/axes use muted CSS vars (works in dark mode)
- Chart hidden if no active contracts
