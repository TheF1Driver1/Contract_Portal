import * as z from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Database } from "@/lib/db";
import { addDays, summarize } from "@/lib/rent/schedule";

// Read-only functions the "ask your data" assistant may call. Each one runs
// with the landlord's own RLS client (never the service role) and also
// filters by owner_id, like the dashboard. They return small JSON objects
// with names and amounts only: no tenant emails, phones or IDs.

type Client = SupabaseClient<Database>;
export type ToolContext = { supabase: Client; userId: string; today: string };

const One = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const cents = (n: number) => Math.round(n * 100) / 100;

type LeaseRow = {
  id: string;
  rent_amount: number | null;
  lease_end: string;
  tenant: { full_name: string | null } | { full_name: string | null }[] | null;
  property: { name: string | null } | { name: string | null }[] | null;
};
const leaseLabel = (r: LeaseRow) => ({
  tenant: One(r.tenant)?.full_name ?? null,
  property: One(r.property)?.name ?? null,
});

const Empty = z.object({});
const ExpiringInput = z.object({ days: z.number().int().min(1).max(365).default(60) });
const MonthInput = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

async function listOverdueLeases(ctx: ToolContext) {
  const { supabase, userId, today } = ctx;
  const { data: leases, error } = await supabase
    .from("contracts")
    .select("id, rent_amount, lease_end, tenant:tenants(full_name), property:properties(name)")
    .eq("owner_id", userId)
    .eq("status", "signed");
  if (error) throw new Error("query failed");
  const rows = (leases ?? []) as unknown as LeaseRow[];
  if (!rows.length) return { overdue: [], leases_without_rent_tracking: 0 };
  const ids = rows.map((r) => r.id);
  const [{ data: ledgers }, { data: charges }, { data: payments }] = await Promise.all([
    supabase.from("rent_ledgers").select("contract_id").in("contract_id", ids),
    supabase.from("rent_charges").select("contract_id, kind, period, due_date, amount, voided_at").in("contract_id", ids),
    supabase.from("payments").select("contract_id, amount, received_on, voided_at").in("contract_id", ids),
  ]);
  const tracked = new Set((ledgers ?? []).map((l) => l.contract_id));
  const overdue = rows
    .filter((r) => tracked.has(r.id))
    .map((r) => {
      const ch = (charges ?? []).filter((c) => c.contract_id === r.id);
      const pa = (payments ?? []).filter((p) => p.contract_id === r.id);
      const s = summarize(
        ch.map((c) => ({ kind: c.kind as "rent" | "late_fee" | "other", period: c.period, due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at })),
        pa.map((p) => ({ amount: Number(p.amount), received_on: p.received_on, voided: !!p.voided_at })),
        today
      );
      return { ...leaseLabel(r), amount_overdue: s.overdue, balance: s.balance };
    })
    .filter((r) => r.amount_overdue > 0)
    .sort((a, b) => b.amount_overdue - a.amount_overdue);
  return { overdue, leases_without_rent_tracking: rows.length - tracked.size };
}

async function listExpiringLeases(ctx: ToolContext, input: z.infer<typeof ExpiringInput>) {
  const { supabase, userId, today } = ctx;
  const until = addDays(today, input.days);
  const { data, error } = await supabase
    .from("contracts")
    .select("id, rent_amount, lease_end, tenant:tenants(full_name), property:properties(name)")
    .eq("owner_id", userId)
    .eq("status", "signed")
    .gte("lease_end", today)
    .lte("lease_end", until)
    .order("lease_end");
  if (error) throw new Error("query failed");
  const rows = (data ?? []) as unknown as LeaseRow[];
  return {
    within_days: input.days,
    leases: rows.map((r) => ({ ...leaseLabel(r), lease_end: r.lease_end, monthly_rent: Number(r.rent_amount) || 0 })),
  };
}

async function rentCollected(ctx: ToolContext, input: z.infer<typeof MonthInput>) {
  const { supabase, userId } = ctx;
  const from = `${input.month}-01`;
  const [y, m] = input.month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const [{ data: payments, error: e1 }, { data: charges, error: e2 }] = await Promise.all([
    supabase.from("payments").select("amount").eq("owner_id", userId).is("voided_at", null).gte("received_on", from).lt("received_on", to),
    supabase.from("rent_charges").select("amount").eq("owner_id", userId).is("voided_at", null).gte("due_date", from).lt("due_date", to),
  ]);
  if (e1 || e2) throw new Error("query failed");
  return {
    month: input.month,
    collected: cents((payments ?? []).reduce((s, p) => s + Number(p.amount), 0)),
    payments_count: (payments ?? []).length,
    charged: cents((charges ?? []).reduce((s, c) => s + Number(c.amount), 0)),
    note: "Only leases with rent tracking (rent ledger) are included.",
  };
}

const URGENCY_ORDER = ["emergency", "urgent", "normal", "low"];

async function openMaintenanceRequests(ctx: ToolContext) {
  const { supabase, userId } = ctx;
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("title, category, urgency, status, created_at, scheduled_for, property:properties(name)")
    .eq("owner_id", userId)
    .in("status", ["open", "scheduled", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error("query failed");
  const rows = (data ?? []) as unknown as {
    title: string;
    category: string;
    urgency: string;
    status: string;
    created_at: string;
    scheduled_for: string | null;
    property: { name: string | null } | { name: string | null }[] | null;
  }[];
  return {
    requests: rows
      .map((r) => ({
        title: r.title,
        property: One(r.property)?.name ?? null,
        category: r.category,
        urgency: r.urgency,
        status: r.status,
        opened_on: r.created_at.slice(0, 10),
        scheduled_for: r.scheduled_for,
      }))
      .sort((a, b) => URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency)),
  };
}

type ToolDef<S extends z.ZodType> = {
  description: string;
  input: S;
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(d: ToolDef<S>) => d;

export const DATA_TOOLS = {
  list_overdue_leases: tool({
    description: "Signed leases with rent tracking whose tenant is behind on rent today: tenant name, property, amount past due and total balance. Also how many signed leases have no rent tracking (their payments are unknown).",
    input: Empty,
    run: (ctx) => listOverdueLeases(ctx),
  }),
  list_expiring_leases: tool({
    description: "Signed leases that end within the next `days` days (default 60), soonest first: tenant name, property, end date and monthly rent.",
    input: ExpiringInput,
    run: (ctx, i) => listExpiringLeases(ctx, i),
  }),
  rent_collected: tool({
    description: "Rent payments received and rent charged in one calendar month (YYYY-MM), for leases with rent tracking.",
    input: MonthInput,
    run: (ctx, i) => rentCollected(ctx, i),
  }),
  open_maintenance_requests: tool({
    description: "Maintenance requests that are open, scheduled or in progress, most urgent first: title, property, category, urgency, status and dates.",
    input: Empty,
    run: (ctx) => openMaintenanceRequests(ctx),
  }),
};

export type DataToolName = keyof typeof DATA_TOOLS;
export const DATA_TOOL_NAMES = Object.keys(DATA_TOOLS) as DataToolName[];

/** Tool definitions for the Messages API, generated from the same Zod schemas that validate input. */
export function dataToolDefinitions(): BetaTool[] {
  return DATA_TOOL_NAMES.map((name) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(DATA_TOOLS[name].input, { io: "input" }) as Record<string, unknown>;
    return { name, description: DATA_TOOLS[name].description, input_schema: { ...schema, type: "object" } as BetaTool["input_schema"] };
  });
}

/** Validates the model's input and runs one tool. Unknown tools and bad input throw. */
export async function runDataTool(ctx: ToolContext, name: string, input: unknown): Promise<unknown> {
  if (!(DATA_TOOL_NAMES as string[]).includes(name)) throw new Error(`unknown tool ${name}`);
  const def = DATA_TOOLS[name as DataToolName] as ToolDef<z.ZodType>;
  const parsed = def.input.safeParse(input ?? {});
  if (!parsed.success) throw new Error("invalid input");
  return def.run(ctx, parsed.data);
}
