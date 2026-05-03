import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildContext, SIG_LANDLORD, SIG_TENANT } from "@/lib/contract-context";
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

// 220 × 55 px at 96 DPI → EMU (1 px = 9525 EMU)
const SIG_CX = 220 * 9525;
const SIG_CY =  55 * 9525;

function sigDrawingXml(rId: string, filename: string, docPrId: number): string {
  return (
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${SIG_CX}" cy="${SIG_CY}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="${filename}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${filename}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SIG_CX}" cy="${SIG_CY}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData></a:graphic>` +
    `</wp:inline>` +
    `</w:drawing></w:r>`
  );
}

export function injectSignaturesIntoDocx(docxBuffer: Buffer, contract: Contract): Buffer {
  const zip = new PizZip(docxBuffer);

  const sigs = [
    { placeholder: SIG_LANDLORD, dataUrl: contract.landlord_signature, rId: "rIdSigL", filename: "sig_landlord.png", docPrId: 100 },
    { placeholder: SIG_TENANT,   dataUrl: contract.tenant_signature,   rId: "rIdSigT", filename: "sig_tenant.png",   docPrId: 101 },
  ];

  let docXml  = zip.file("word/document.xml")!.asText();
  let relsXml = zip.file("word/_rels/document.xml.rels")?.asText() ??
    `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  for (const sig of sigs) {
    if (!sig.dataUrl) continue;

    const base64 = sig.dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    zip.file(`word/media/${sig.filename}`, Buffer.from(base64, "base64"));

    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${sig.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${sig.filename}"/></Relationships>`
    );

    const escaped = sig.placeholder.replace(/[[\]]/g, "\\$&");
    docXml = docXml.replace(
      new RegExp(`<w:r[^>]*>[\\s\\S]*?<w:t[^>]*>${escaped}</w:t></w:r>`),
      sigDrawingXml(sig.rId, sig.filename, sig.docPrId)
    );
  }

  zip.file("word/document.xml", docXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  return zip.generate({ type: "nodebuffer" }) as Buffer;
}
