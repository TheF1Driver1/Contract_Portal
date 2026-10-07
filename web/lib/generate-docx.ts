import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildContext } from "@/lib/contract-context";
import { createClient } from "@/lib/supabase-server";
import type { Contract } from "@/lib/types";
import { downloadTemplate } from "@/lib/template-storage";

export async function fetchTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  contractTypeVal: string,
  templateId: string | null,
  fallbackUrl: string
): Promise<Buffer> {
  if (templateId) {
    const { data: tmpl } = await supabase
      .from("contract_templates")
      .select("file_url")
      .eq("id", templateId)
      .eq("owner_id", userId)
      .single();
    if (tmpl?.file_url) {
    const buf = await downloadTemplate(supabase, tmpl.file_url);
    if (buf) return buf;
    }
  }

  const { data: exact } = await supabase
    .from("contract_templates")
    .select("file_url")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .eq("contract_type", contractTypeVal)
    .single();
  if (exact?.file_url) {
    const buf = await downloadTemplate(supabase, exact.file_url);
    if (buf) return buf;
  }

  const { data: all } = await supabase
    .from("contract_templates")
    .select("file_url")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .eq("contract_type", "all")
    .single();
  if (all?.file_url) {
    const buf = await downloadTemplate(supabase, all.file_url);
    if (buf) return buf;
  }

  const res = await fetch(fallbackUrl);
  if (res.ok) return Buffer.from(await res.arrayBuffer());

  return Buffer.alloc(0);
}

export function renderDocx(templateBuffer: Buffer, contract: Contract): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });
  doc.render(buildContext(contract));
  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}
