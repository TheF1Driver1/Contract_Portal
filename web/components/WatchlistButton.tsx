"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Heart, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function WatchlistButton({ property, saved }: { property: any; saved: boolean }) {
  const t = useTranslations("market.watchlistButton")
  const [isSaved, setIsSaved] = useState(saved)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = isSaved
        ? await fetch("/api/watchlist", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ zillow_id: property.id }),
          })
        : await fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              zillow_id: String(property.id),
              price: property.price,
              beds: property.beds,
              baths: property.baths,
              street: property.street,
              city: property.city,
              state: property.state,
              img_src: property.imgSrc || undefined,
              detail_url: property.detailUrl || undefined,
              home_type: property.homeType,
              home_status: property.homeStatus,
            }),
          })
      if (!res.ok) throw new Error(String(res.status))
      toast.success(isSaved ? t("removed") : t("added"))
      setIsSaved(!isSaved)
    } catch {
      toast.error(t("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isSaved ? "secondary" : "outline"}
      onClick={toggle}
      disabled={loading}
      aria-pressed={isSaved}
      className="min-h-10"
    >
      {loading
        ? <Loader2 className="animate-spin" aria-hidden />
        : <Heart className={cn(isSaved && "fill-current text-primary")} aria-hidden />}
      {isSaved ? t("saved") : t("save")}
    </Button>
  )
}
