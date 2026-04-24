import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Heart, ArrowRight, ExternalLink, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { WatchlistItem } from "@/lib/types";

export default async function WatchlistPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("watchlist")
    .select("*")
    .eq("owner_id", user!.id)
    .order("saved_at", { ascending: false });

  const items = (data ?? []) as WatchlistItem[];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="animate-slide-up">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Saved
        </p>
        <h1
          className="text-4xl font-bold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
        >
          Watchlist
        </h1>
      </div>

      {items.length === 0 ? (
        <div
          className="surface-card p-12 flex flex-col items-center gap-4 text-center animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface-container)" }}
          >
            <Heart className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No saved properties
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Browse market listings and save properties you're interested in
            </p>
          </div>
          <Link href="/market" className="btn-primary-gradient flex items-center gap-1.5">
            Browse Market
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              className="surface-card overflow-hidden group"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}
            >
              {/* ── Image ── */}
              <div className="relative h-44 overflow-hidden" style={{ background: "var(--surface-container)" }}>
                {item.img_src ? (
                  <img
                    src={item.img_src}
                    alt={item.street ?? "Property"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart className="h-8 w-8" style={{ color: "var(--text-muted)" }} strokeWidth={1} />
                  </div>
                )}

                {/* Zillow link — top-right icon */}
                {item.detail_url && (
                  <a
                    href={item.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full glass transition-opacity duration-200 hover:opacity-80"
                    aria-label="View on Zillow"
                  >
                    <ExternalLink className="h-3.5 w-3.5" style={{ color: "var(--text-primary)" }} />
                  </a>
                )}

                {/* Bottom gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
              </div>

              {/* ── Content ── */}
              <div className="p-4 space-y-3">
                <div>
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.street ?? "—"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {[item.city, item.state].filter(Boolean).join(", ")}
                  </p>
                </div>

                <div className="flex items-end justify-between">
                  <p
                    className="text-xl font-bold"
                    style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
                  >
                    {item.price ? formatCurrency(item.price) : "—"}
                  </p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {item.beds != null && <span>{item.beds} bd</span>}
                    {item.baths != null && <span>{item.baths} ba</span>}
                  </div>
                </div>

                {/* ── Analyze CTA ── */}
                <Link
                  href={`/watchlist/${item.id}/analyze`}
                  className="btn-primary-gradient flex items-center justify-center gap-2 w-full"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Analyze Investment
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
