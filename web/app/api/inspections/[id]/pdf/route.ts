import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import type { InspectionItem, InspectionPhoto } from "@/lib/db";
import { loadInspection } from "@/lib/inspections/load";
import { renderInspectionPdf, type InspectionPdfItem } from "@/lib/inspections/pdf";
import { tenantHasLease } from "@/lib/maintenance/service";
import { PHOTO_BUCKET } from "@/lib/maintenance/logic";

export const dynamic = "force-dynamic";

/** Embedded thumbnails per report; the rest are listed as a count. */
const MAX_IMAGES = 40;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// The landlord (owner) or the tenant of the lease (redeemed invite, completed inspections only).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: insp } = await admin.from("inspections").select("id, owner_id, contract_id, status").eq("id", id).maybeSingle();
  if (!insp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isLandlord = insp.owner_id === user.id;
  if (!isLandlord && !(insp.status === "completed" && (await tenantHasLease(admin, user.id, insp.contract_id)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loaded = await loadInspection(admin, id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: contract }, { data: owner }, { data: reader }] = await Promise.all([
    admin.from("contracts").select("unit_number, property:properties(name, address, city), tenant:tenants(full_name, preferred_locale)").eq("id", insp.contract_id).maybeSingle(),
    admin.from("profiles").select("full_name, company_name, email, locale").eq("id", insp.owner_id).maybeSingle(),
    admin.from("profiles").select("locale").eq("id", user.id).maybeSingle(),
  ]);
  const property = contract?.property as { name?: string; address?: string; city?: string } | null;
  const tenant = contract?.tenant as { full_name?: string; preferred_locale?: string } | null;

  // Embed JPEG/PNG photos as thumbnails, up to a budget; HEIC/WebP are counted only.
  const images = new Map<string, InspectionPdfItem["images"]>();
  let budget = MAX_IMAGES;
  for (const p of loaded.photos as InspectionPhoto[]) {
    if (!p.item_id || budget <= 0) continue;
    const format = /\.jpg$/i.test(p.path) ? "jpg" : /\.png$/i.test(p.path) ? "png" : null;
    if (!format) continue;
    const { data: blob } = await admin.storage.from(PHOTO_BUCKET).download(p.path);
    if (!blob || blob.size > MAX_IMAGE_BYTES) continue;
    const list = images.get(p.item_id) ?? [];
    list.push({ data: Buffer.from(await blob.arrayBuffer()), format });
    images.set(p.item_id, list);
    budget--;
  }

  const pdf = await renderInspectionPdf({
    kind: loaded.raw.kind,
    draft: loaded.raw.status !== "completed",
    inspectedOn: loaded.raw.inspected_on,
    property: [property?.name, contract?.unit_number, property?.address, property?.city].filter(Boolean).join(", ") || "—",
    tenant: tenant?.full_name ?? "—",
    landlord: owner?.company_name || owner?.full_name || owner?.email || "—",
    notes: loaded.raw.notes,
    completedAt: loaded.raw.landlord_signed_at,
    ackAt: loaded.raw.tenant_acknowledged_at,
    ackName: loaded.raw.tenant_ack_name,
    locale: isLandlord ? owner?.locale : (reader?.locale ?? tenant?.preferred_locale),
    items: loaded.items.map((i) => ({
      room: i.room,
      item: i.item,
      condition: i.condition as InspectionItem["condition"],
      note: i.note,
      sort: i.sort,
      baseline: i.baseline?.condition,
      photoCount: i.photos.length,
      images: images.get(i.id) ?? [],
    })),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="inspeccion-${loaded.raw.kind === "move_in" ? "entrada" : "salida"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
