import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { canExportScheduleE } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types";
import type { PropertyReport } from "@/lib/pdf-schedule-e";
import React from "react";

const SCHEDULE_E_LINES: Record<string, { line: number; label: string }> = {
  advertising:  { line: 5,  label: "Advertising" },
  insurance:    { line: 9,  label: "Insurance" },
  management:   { line: 11, label: "Management fees" },
  mortgage:     { line: 12, label: "Mortgage interest (deductible)" },
  repairs:      { line: 14, label: "Repairs" },
  maintenance:  { line: 14, label: "Repairs & maintenance" },
  taxes:        { line: 16, label: "Taxes" },
  utilities:    { line: 17, label: "Utilities" },
  hoa:          { line: 19, label: "Other (HOA)" },
  other:        { line: 19, label: "Other" },
};

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "free") as SubscriptionPlan;
  if (!canExportScheduleE(plan)) {
    return NextResponse.json(
      { error: "Schedule E export requires the Inversionista plan", upgrade_required: true },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year) || year < 2000 || year > 2099) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: properties } = await admin
    .from("properties")
    .select("id, name, address, city, state")
    .eq("owner_id", user.id);

  if (!properties?.length) {
    return NextResponse.json({ error: "No properties found" }, { status: 404 });
  }

  const { data: expenses } = await admin
    .from("property_expenses")
    .select("*")
    .eq("user_id", user.id)
    .gte("expense_date", `${year}-01-01`)
    .lte("expense_date", `${year}-12-31`);

  const { data: contracts } = await admin
    .from("contracts")
    .select("property_id, rent_amount, lease_start, lease_end")
    .eq("owner_id", user.id)
    .eq("status", "signed");

  const propertyReports: PropertyReport[] = properties.map((prop) => {
    const propExpenses = (expenses ?? []).filter((e) => e.property_id === prop.id);

    let totalIncome = 0;
    (contracts ?? [])
      .filter((c) => c.property_id === prop.id)
      .forEach((c) => {
        const start = new Date(Math.max(new Date(c.lease_start).getTime(), new Date(`${year}-01-01`).getTime()));
        const end   = new Date(Math.min(new Date(c.lease_end).getTime(),   new Date(`${year}-12-31`).getTime()));
        if (end > start) {
          const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
          totalIncome += c.rent_amount * Math.min(months, 12);
        }
      });

    const lineItems: Record<number, { label: string; amount: number }> = {};
    propExpenses.forEach((e) => {
      const mapping = SCHEDULE_E_LINES[e.category];
      if (!mapping) return;
      const line = mapping.line;
      if (!lineItems[line]) lineItems[line] = { label: mapping.label, amount: 0 };
      lineItems[line].amount += e.amount;
    });

    const totalExpenses = Object.values(lineItems).reduce((s, l) => s + l.amount, 0);
    const netIncome = totalIncome - totalExpenses;

    return { prop, totalIncome, lineItems, totalExpenses, netIncome };
  });

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { ScheduleEDocument } = await import("@/lib/pdf-schedule-e");

  const pdfBuffer = await renderToBuffer(
    React.createElement(ScheduleEDocument, { year, reports: propertyReports }) as any
  );

  return new NextResponse(Buffer.from(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schedule-e-${year}.pdf"`,
    },
  });
}
