"use client"
import { useState } from "react"

interface Filters { city: string; min_price: string; max_price: string; beds: string }
interface Props { onSearch: (f: Filters) => void }

export default function MapFilters({ onSearch }: Props) {
  const [f, setF] = useState<Filters>({ city: "", min_price: "", max_price: "", beds: "" })
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <select value={f.city} onChange={e => setF({ ...f, city: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm">
        <option value="">All Cities</option>
        {["San Juan","Ponce","Aguadilla","Carolina","Mayaguez"].map(c =>
          <option key={c} value={c}>{c}</option>)}
      </select>
      <input placeholder="Min price" value={f.min_price}
        onChange={e => setF({ ...f, min_price: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm w-28" />
      <input placeholder="Max price" value={f.max_price}
        onChange={e => setF({ ...f, max_price: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm w-28" />
      <select value={f.beds} onChange={e => setF({ ...f, beds: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm">
        <option value="">Any beds</option>
        {["1","2","3","4"].map(n => <option key={n} value={n}>{n}+</option>)}
      </select>
      <button onClick={() => onSearch(f)}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm min-h-[44px]">
        Search
      </button>
    </div>
  )
}
