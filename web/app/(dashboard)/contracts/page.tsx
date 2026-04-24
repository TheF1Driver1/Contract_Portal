import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<string, string> = {
  signed:  "pill-active",
  draft:   "pill-draft",
  sent:    "pill-sent",
  expired: "pill-expired",
};

const STATUS_FILTERS = ["all", "draft", "sent", "signed", "expired"];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("contracts")
    .select("*, property:properties(name, address), tenant:tenants(full_name, email, phone)")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  const { data: contracts } = await query;
  const all = (contracts ?? []) as Contract[];

  const filtered = searchParams.q
    ? all.filter(
        (c) =>
          c.tenant?.full_name?.toLowerCase().includes(searchParams.q!.toLowerCase()) ||
          c.property?.name?.toLowerCase().includes(searchParams.q!.toLowerCase())
      )
    : all;

  const activeStatus = searchParams.status ?? "all";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="animate-slide-up">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Leases
          </p>
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            Contracts
          </h1>
        </div>
        <Link
          href="/contracts/new"
          className="btn-primary-gradient flex items-center gap-2 animate-slide-up"
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          <Plus className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      {/* ── Filters ── */}
      <div
        className="flex flex-wrap gap-3 animate-slide-up"
        style={{ animationDelay: "0.08s", animationFillMode: "both" }}
      >
        <form className="flex-1 min-w-[200px]">
          <input
            name="q"
            className="input-tonal"
            placeholder="Search tenant or property…"
            defaultValue={searchParams.q ?? ""}
          />
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/contracts" : `/contracts?status=${s}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200",
                activeStatus === s
                  ? s === "signed"  ? "pill-active"
                  : s === "sent"    ? "pill-sent"
                  : s === "expired" ? "pill-expired"
                  : s === "draft"   ? "pill-draft"
                  : "pill-active"
                  : "btn-tonal"
              )}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div
          className="surface-card p-12 flex flex-col items-center gap-4 text-center animate-slide-up"
          style={{ animationDelay: "0.12s", animationFillMode: "both" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface-container)" }}
          >
            <FileText className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No contracts found
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {searchParams.q || searchParams.status
                ? "Try a different filter or search term"
                : "Create your first lease contract to get started"}
            </p>
          </div>
          <Link href="/contracts/new" className="btn-primary-gradient flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Contract
          </Link>
        </div>
      ) : (
        <div
          className="surface-card p-2 animate-slide-up"
          style={{ animationDelay: "0.12s", animationFillMode: "both" }}
        >
          {filtered.map((c, i) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="row-tonal flex items-center justify-between p-4 mx-1 my-1"
              style={{ animationDelay: `${i * 0.03}s`, animationFillMode: "both" }}
            >
              {/* Left: tenant + property */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {c.tenant?.full_name ?? "Unknown Tenant"}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {c.property?.name ?? "—"} · {formatCurrency(c.rent_amount)}/mo
                </p>
              </div>

              {/* Right: dates + status */}
              <div className="ml-4 flex items-center gap-4 shrink-0">
                <div className="hidden sm:block text-right">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(c.lease_start)}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    → {formatDate(c.lease_end)}
                  </p>
                </div>
                <span className={STATUS_PILL[c.status] ?? "pill-draft"}>{c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
