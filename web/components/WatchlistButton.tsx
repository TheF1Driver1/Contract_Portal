"use client"
import { useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WatchlistButton({ property, saved }: { property: any; saved: boolean }) {
  const [isSaved, setIsSaved] = useState(saved)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    if (isSaved) {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zillow_id: property.id }),
      })
    } else {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zillow_id: property.id,
          price: property.price,
          beds: property.beds,
          baths: property.baths,
          street: property.street,
          city: property.city,
          state: property.state,
          img_src: property.imgSrc,
          detail_url: property.detailUrl,
          home_type: property.homeType,
          home_status: property.homeStatus,
        }),
      })
    }
    setIsSaved(!isSaved)
    setLoading(false)
  }

  return (
    <Button variant={isSaved ? "default" : "outline"} onClick={toggle} disabled={loading}>
      <Heart className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
      {isSaved ? "Saved" : "Save to Watchlist"}
    </Button>
  )
}
