"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import MapFilters from "@/components/MapFilters";
import MarketListView from "@/components/MarketListView";
import type { MarketProperty } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Filters { city: string; min_price: string; max_price: string; beds: string }

const MarketMap = dynamic(() => import("@/components/MarketMap"), { ssr: false });

export default function MarketPage() {
  const [filters, setFilters] = useState<Filters>({ city: "", min_price: "", max_price: "", beds: "" });
  const [properties, setProperties] = useState<MarketProperty[]>([]);
  const [view, setView] = useState<"map" | "list">("map");

  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    );
    fetch(`/api/market/properties?${params}`)
      .then((r) => r.json())
      .then((d) => setProperties(Array.isArray(d) ? d : []));
  }, [filters]);

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
    </div>
  );
}
