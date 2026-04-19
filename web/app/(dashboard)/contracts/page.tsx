import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract } from "@/lib/types";

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

  const STATUS_FILTERS = ["all", "draft", "sent", "signed", "expired"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">{all.length} total</p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form className="flex-1 min-w-[200px]">
          <Input
            name="q"
            placeholder="Search by tenant or property..."
            defaultValue={searchParams.q ?? ""}
          />
        </form>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/contracts" : `/contracts?status=${s}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                (searchParams.status ?? "all") === s
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No contracts found</p>
          <p className="text-sm text-muted-foreground">Create your first contract to get started.</p>
          <Button asChild size="sm">
            <Link href="/contracts/new">New Contract</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Rent</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{c.tenant?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.tenant?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{c.property?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(c.rent_amount)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(c.lease_start)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(c.lease_end)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status as "draft" | "sent" | "signed" | "expired"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contracts/${c.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => (
              <Link key={c.id} href={`/contracts/${c.id}`} className="block bg-card rounded-lg p-4 border">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{c.tenant?.full_name ?? "—"}</span>
                  <Badge variant={c.status as "draft" | "sent" | "signed" | "expired"}>
                    {c.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.property?.name ?? "—"}</p>
                <p className="text-sm mt-1">{formatCurrency(c.rent_amount)}/mo · {formatDate(c.lease_start)} – {formatDate(c.lease_end)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
