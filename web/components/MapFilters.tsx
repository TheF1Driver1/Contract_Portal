"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface MarketFilters { city: string; min_price: string; max_price: string; beds: string }
interface Props {
  onSearch: (f: MarketFilters) => void
  initial?: MarketFilters
  /** "inline" = toolbar row (desktop), "stacked" = one field per row (sheet on phones). */
  layout?: "inline" | "stacked"
}

const CITIES = ["San Juan", "Ponce", "Aguadilla", "Carolina", "Mayaguez"]
const ANY = "any"
const EMPTY: MarketFilters = { city: "", min_price: "", max_price: "", beds: "" }

export default function MapFilters({ onSearch, initial = EMPTY, layout = "inline" }: Props) {
  const t = useTranslations("market.filters")
  const [f, setF] = useState<MarketFilters>(initial)
  const stacked = layout === "stacked"
  const id = (name: string) => `market-${layout}-${name}`

  return (
    <form
      className={cn("flex gap-3", stacked ? "flex-col" : "flex-wrap items-end")}
      onSubmit={(e) => { e.preventDefault(); onSearch(f) }}
    >
      <div className={cn("space-y-1.5", !stacked && "w-44")}>
        <Label htmlFor={id("city")}>{t("city")}</Label>
        <Select value={f.city || ANY} onValueChange={(v) => setF({ ...f, city: v === ANY ? "" : v })}>
          <SelectTrigger id={id("city")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t("allCities")}</SelectItem>
            {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className={cn("space-y-1.5", !stacked && "w-32")}>
        <Label htmlFor={id("min")}>{t("minPrice")}</Label>
        <Input id={id("min")} inputMode="numeric" className="tabular" placeholder="0"
          value={f.min_price} onChange={(e) => setF({ ...f, min_price: e.target.value })} />
      </div>
      <div className={cn("space-y-1.5", !stacked && "w-32")}>
        <Label htmlFor={id("max")}>{t("maxPrice")}</Label>
        <Input id={id("max")} inputMode="numeric" className="tabular" placeholder={t("noLimit")}
          value={f.max_price} onChange={(e) => setF({ ...f, max_price: e.target.value })} />
      </div>
      <div className={cn("space-y-1.5", !stacked && "w-32")}>
        <Label htmlFor={id("beds")}>{t("beds")}</Label>
        <Select value={f.beds || ANY} onValueChange={(v) => setF({ ...f, beds: v === ANY ? "" : v })}>
          <SelectTrigger id={id("beds")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t("anyBeds")}</SelectItem>
            {["1", "2", "3", "4"].map((n) => <SelectItem key={n} value={n}>{t("bedsMin", { count: Number(n) })}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className={cn("min-h-10", stacked && "w-full")}>
        <Search aria-hidden />
        {t("search")}
      </Button>
    </form>
  )
}
