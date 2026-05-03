import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildContext } from "@/lib/contract-context";
import { createClient } from "@/lib/supabase-server";
import type { Contract } from "@/lib/types";

export async function fetchTemplate(
  supabase: ReturnType<typeof createClient>,
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
      const res = await fetch(tmpl.file_url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
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
    const res = await fetch(exact.file_url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }

  const { data: all } = await supabase
    .from("contract_templates")
    .select("file_url")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .eq("contract_type", "all")
    .single();
  if (all?.file_url) {
    const res = await fetch(all.file_url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
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
