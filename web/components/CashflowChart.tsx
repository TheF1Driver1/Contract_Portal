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
