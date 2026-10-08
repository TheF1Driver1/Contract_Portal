// Server-side helpers for maintenance requests and inspections (Plan 36):
// tenant access checks, signed photo URLs and notification emails.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MaintenanceRequest, MaintenanceStatus } from "@/lib/db";
import { emailLayout } from "@/lib/emails/layout";
import { emailT } from "@/lib/emails/translator";
import { sendResendEmail } from "@/lib/notify";
import { SITE_URL } from "@/lib/seo";
import { PHOTO_BUCKET } from "@/lib/maintenance/logic";

type Client = SupabaseClient<Database>;

const appBase = () => SITE_URL.replace(/\/$/, "");

/** True when this user redeemed a tenant invite for the lease. */
export async function tenantHasLease(admin: Client, userId: string, contractId: string): Promise<boolean> {
  const { data } = await admin
    .from("tenant_invites")
    .select("id")
    .eq("contract_id", contractId)
    .eq("used_by", userId)
    .eq("used", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Leases this user can see in the tenant portal. */
export async function tenantLeaseIds(admin: Client, userId: string): Promise<string[]> {
  const { data } = await admin.from("tenant_invites").select("contract_id").eq("used_by", userId).eq("used", true);
  return [...new Set((data ?? []).map((i) => i.contract_id as string).filter(Boolean))];
}

/**
 * Who the caller is for a request: its landlord, or the tenant of its lease.
 * Reads with the service role, so call it before trusting anything else.
 */
export async function requestRole(
  admin: Client,
  userId: string,
  requestId: string
): Promise<{ request: MaintenanceRequest; role: "landlord" | "tenant" } | null> {
  const { data } = await admin.from("maintenance_requests").select("*").eq("id", requestId).maybeSingle();
  if (!data) return null;
  const request = data as MaintenanceRequest;
  if (request.owner_id === userId) return { request, role: "landlord" };
  if (request.contract_id && (await tenantHasLease(admin, userId, request.contract_id))) return { request, role: "tenant" };
  return null;
}

/** Short-lived signed URLs for private photos (path → url). */
export async function signedPhotoUrls(admin: Client, paths: string[], expiresIn = 600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(paths, expiresIn);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

type RequestContext = {
  request: MaintenanceRequest;
  property: string;
  landlord: { email: string | null; locale: string | null; name: string };
  tenant: { email: string | null; locale: string | null; name: string };
};

async function contextFor(admin: Client, requestId: string): Promise<RequestContext | null> {
  const { data } = await admin.from("maintenance_requests").select("*").eq("id", requestId).maybeSingle();
  if (!data) return null;
  const request = data as MaintenanceRequest;
  const [{ data: property }, { data: owner }, { data: contract }] = await Promise.all([
    admin.from("properties").select("name, address").eq("id", request.property_id).maybeSingle(),
    admin.from("profiles").select("email, locale, full_name, company_name").eq("id", request.owner_id).maybeSingle(),
    request.contract_id
      ? admin.from("contracts").select("unit_number, tenant:tenants(full_name, email, preferred_locale)").eq("id", request.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const tenant = (contract?.tenant ?? null) as { full_name?: string; email?: string | null; preferred_locale?: string } | null;
  // Fall back to the address the tenant redeemed their invite with.
  let tenantEmail = tenant?.email ?? null;
  if (!tenantEmail && request.contract_id) {
    const { data: inv } = await admin.from("tenant_invites").select("tenant_email").eq("contract_id", request.contract_id).eq("used", true).limit(1).maybeSingle();
    tenantEmail = inv?.tenant_email ?? null;
  }
  return {
    request,
    property: [property?.name || property?.address, contract?.unit_number].filter(Boolean).join(" · ") || "—",
    landlord: { email: owner?.email ?? null, locale: owner?.locale ?? "es", name: owner?.company_name || owner?.full_name || "" },
    tenant: { email: tenantEmail, locale: tenant?.preferred_locale ?? "es", name: tenant?.full_name ?? "" },
  };
}

/** Tells the landlord a tenant filed a request. Throws when the email cannot be sent. */
export async function emailLandlordNewRequest(admin: Client, requestId: string): Promise<void> {
  const ctx = await contextFor(admin, requestId);
  if (!ctx?.landlord.email) return;
  const { lang, t } = emailT(ctx.landlord.locale);
  const r = ctx.request;
  const vars = {
    tenant: ctx.tenant.name || t("maintenance.tenantFallback"),
    property: ctx.property,
    title: r.title,
    category: t(`maintenance.category.${r.category}`),
    urgency: t(`maintenance.urgency.${r.urgency}`),
  };
  await sendResendEmail(
    ctx.landlord.email,
    t(r.urgency === "emergency" || r.urgency === "urgent" ? "maintenance.newRequest.subjectUrgent" : "maintenance.newRequest.subject", vars),
    emailLayout({
      lang,
      heading: t("maintenance.newRequest.heading"),
      paragraphs: [t("maintenance.newRequest.body", vars), ...(r.description ? [r.description] : [])],
      cta: { label: t("maintenance.newRequest.cta"), url: `${appBase()}/maintenance/${r.id}` },
      footer: t("maintenance.footerLandlord"),
    })
  );
}

/** Tells the tenant their request was scheduled or resolved, in their language. */
export async function emailTenantStatus(admin: Client, requestId: string, status: MaintenanceStatus): Promise<void> {
  if (status !== "scheduled" && status !== "resolved") return;
  const ctx = await contextFor(admin, requestId);
  if (!ctx?.tenant.email) return;
  const { lang, t } = emailT(ctx.tenant.locale);
  const r = ctx.request;
  const date = r.scheduled_for
    ? new Date(`${r.scheduled_for}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { dateStyle: "long", timeZone: "UTC" })
    : "";
  const vars = { name: ctx.tenant.name.split(" ")[0] || "", title: r.title, property: ctx.property, date, vendor: r.vendor_name ?? "" };
  const paragraphs =
    status === "scheduled"
      ? [t(date ? "maintenance.status.scheduledBody" : "maintenance.status.scheduledNoDate", vars), ...(r.vendor_name ? [t("maintenance.status.vendor", vars)] : [])]
      : [t("maintenance.status.resolvedBody", vars)];
  await sendResendEmail(
    ctx.tenant.email,
    t(`maintenance.status.${status}Subject`, vars),
    emailLayout({
      lang,
      heading: t(`maintenance.status.${status}Heading`),
      paragraphs,
      cta: { label: t("maintenance.status.cta"), url: `${appBase()}/portal` },
      footer: t("footerAuto"),
    })
  );
}

/** Invites the tenant to review a completed inspection in the portal. */
export async function emailTenantInspection(admin: Client, inspectionId: string): Promise<void> {
  const { data: insp } = await admin.from("inspections").select("id, kind, contract_id").eq("id", inspectionId).maybeSingle();
  if (!insp) return;
  const { data: contract } = await admin
    .from("contracts")
    .select("unit_number, property:properties(name, address), tenant:tenants(full_name, email, preferred_locale)")
    .eq("id", insp.contract_id)
    .maybeSingle();
  const tenant = (contract?.tenant ?? null) as { full_name?: string; email?: string | null; preferred_locale?: string } | null;
  if (!tenant?.email) return;
  const property = contract?.property as { name?: string; address?: string } | null;
  const { lang, t } = emailT(tenant.preferred_locale);
  const vars = {
    name: (tenant.full_name ?? "").split(" ")[0],
    kind: t(`maintenance.inspection.kind.${insp.kind}`),
    property: [property?.name || property?.address, contract?.unit_number].filter(Boolean).join(" · "),
  };
  await sendResendEmail(
    tenant.email,
    t("maintenance.inspection.subject", vars),
    emailLayout({
      lang,
      heading: t("maintenance.inspection.heading", vars),
      paragraphs: [t("maintenance.inspection.body", vars)],
      cta: { label: t("maintenance.inspection.cta"), url: `${appBase()}/portal/inspections/${insp.id}` },
      footer: t("footerAuto"),
    })
  );
}
