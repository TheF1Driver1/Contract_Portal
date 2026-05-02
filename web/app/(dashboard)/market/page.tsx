"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import MapFilters from "@/components/MapFilters";
import MarketListView from "@/components/MarketListView";
import type { MarketProperty } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

interface Filters { city: string; min_price: string; max_price: string; beds: string }

interface CityStats {
  city: string; count: number;
  avg_price: number | null; avg_days: number | null; avg_motivation: number | null;
}
interface TopMotivated {
  id: string; street: string | null; city: string | null; state: string | null;
  price: number | null; desperation_score: number | null;
  num_price_cuts: number | null; price_cut_pct: number | null;
}

function motivationColor(score: number) {
  if (score >= 61) return "#ef4444"
  if (score >= 41) return "#f97316"
  if (score >= 21) return "#eab308"
  return "#6b7280"
}

const MarketMap = dynamic(() => import("@/components/MarketMap"), { ssr: false });

export default function MarketPage() {
  const [filters, setFilters] = useState<Filters>({ city: "", min_price: "", max_price: "", beds: "" });
  const [properties, setProperties] = useState<MarketProperty[]>([]);
  const [view, setView] = useState<"map" | "list">("map");
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [topMotivated, setTopMotivated] = useState<TopMotivated[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    );
    fetch(`/api/market/properties?${params}`)
      .then((r) => r.json())
      .then((d) => setProperties(Array.isArray(d) ? d : []));
  }, [filters]);

  useEffect(() => {
    fetch("/api/market/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setCityStats(d.stats);
        if (d.top_motivated) setTopMotivated(d.top_motivated);
      });
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Intelligence
          </p>
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            Market
          </h1>
        </div>

        {/* View toggle */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "var(--surface-container)" }}
        >
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium capitalize",
                view === v ? "toggle-active" : "toggle-inactive"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="animate-slide-up" style={{ animationDelay: "0.06s", animationFillMode: "both" }}>
        <MapFilters onSearch={setFilters} />
      </div>

      {/* ── Listings count ── */}
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {properties.length} listing{properties.length !== 1 ? "s" : ""}
      </p>

      {/* ── Content ── */}
      <div
        className="animate-slide-up"
        style={{ animationDelay: "0.10s", animationFillMode: "both" }}
      >
        {view === "map" ? (
          <div className="surface-card overflow-hidden" style={{ height: 600 }}>
            <MarketMap properties={properties} />
          </div>
        ) : (
          <MarketListView properties={properties} />
        )}
      </div>

      {/* ── Analytics ── */}
      {(cityStats.length > 0 || topMotivated.length > 0) && (
        <div
          className="grid gap-6 lg:grid-cols-2 animate-slide-up"
          style={{ animationDelay: "0.14s", animationFillMode: "both" }}
        >
          {/* City stats */}
          {cityStats.length > 0 && (
            <div className="surface-card space-y-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>By City</p>
              <div className="space-y-2">
                {cityStats.map((s) => (
                  <div key={s.city} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{s.city}</span>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{s.count} listings</span>
                      {s.avg_price && <span>{formatCurrency(s.avg_price)} avg</span>}
                      {s.avg_motivation != null && s.avg_motivation > 0 && (
                        <span style={{ color: motivationColor(s.avg_motivation) }}>
                          ⚡ {s.avg_motivation} motivation
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top motivated sellers */}
          {topMotivated.length > 0 && (
            <div className="surface-card space-y-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Most Motivated Sellers</p>
              <div className="space-y-3">
                {topMotivated.map((p) => (
                  <a key={p.id} href={`/market/${p.id}`} className="block group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium group-hover:underline" style={{ color: "var(--text-primary)" }}>
                          {p.street ?? "—"}, {p.city}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {p.price ? formatCurrency(p.price) : "—"}
                          {p.num_price_cuts != null && p.num_price_cuts > 0 && ` · ${p.num_price_cuts} cuts · ↓${p.price_cut_pct}%`}
                        </p>
                      </div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: motivationColor(p.desperation_score ?? 0) }}
                      >
                        {p.desperation_score}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
