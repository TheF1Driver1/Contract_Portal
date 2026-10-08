import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireFeature } from "@/lib/entitlements";
import { getTaxResidency, loadAnnualPackage, viewFor } from "@/lib/tax/load";
import { packageToCsv, type TaxView } from "@/lib/tax/annual";
import { renderAnnualPdf, taxT } from "@/lib/tax/pdf";
import type { AnejoNKey, ExpenseCategory } from "@/lib/tax/mapping";

export const dynamic = "force-dynamic";

/** GET /api/reports/annual?year=2026&property=<id>&view=anejo_n|schedule_e&format=pdf|csv */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });

  const gate = await requireFeature(supabase, user.id, "expense_export");
  if (gate) return gate;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2099) return NextResponse.json({ error: "Año inválido." }, { status: 400 });
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  const rawProperty = url.searchParams.get("property");
  const propertyId = rawProperty && /^[0-9a-f-]{36}$/i.test(rawProperty) ? rawProperty : null;

  const [{ data: profile }, residency] = await Promise.all([
    supabase.from("profiles").select("full_name, company_name, locale").eq("id", user.id).maybeSingle(),
    getTaxResidency(supabase, user.id),
  ]);
  const rawView = url.searchParams.get("view");
  const view: TaxView = rawView === "schedule_e" || rawView === "anejo_n" ? rawView : viewFor(residency);

  // RLS-aware client: only the caller's rows are read.
  const pkg = await loadAnnualPackage(supabase, user.id, year, propertyId);
  if (propertyId && pkg.properties.length === 0) return NextResponse.json({ error: "Propiedad no encontrada." }, { status: 404 });

  const { t } = taxT(profile?.locale);
  const suffix = propertyId ? `-${pkg.properties[0].name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";
  const filename = `${t("pdf.filename")}-${year}${suffix}`;

  if (format === "csv") {
    const csv = packageToCsv(pkg, {
      header: [
        t("csv.year"),
        t("csv.property"),
        t("csv.kind"),
        t("csv.category"),
        t("csv.scheduleELine"),
        t("csv.scheduleEName"),
        t("csv.anejoN"),
        t("csv.anejoNReview"),
        t("csv.amount"),
        t("csv.estimated"),
      ],
      lineKind: (k) => t(`csv.lineKind.${k}`),
      category: (c: ExpenseCategory) => t(`category.${c}`),
      anejoN: (k: AnejoNKey) => t(`anejoN.${k}`),
      yes: t("csv.yes"),
      no: t("csv.no"),
      pendingReview: t("reviewNotice.title"),
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await renderAnnualPdf({
    pkg,
    view,
    locale: profile?.locale,
    ownerName: profile?.company_name || profile?.full_name || user.email || "",
    propertyLabel: propertyId ? pkg.properties[0].name : t("annual.allProperties"),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
