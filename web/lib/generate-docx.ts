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
  const rendered = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return embedSignaturesInDocx(rendered, contract.landlord_signature ?? null, contract.tenant_signature ?? null);
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, "base64");
}

function makeDrawingXml(rId: string, picId: number, picName: string): string {
  const cx = 2000000; // ~2.2 in wide
  const cy = 700000;  // ~0.77 in tall
  return (
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${picId}" name="${picName}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${picId}" name="${picName}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  );
}

function replaceMarkerWithDrawing(
  xml: string,
  marker: string,
  rId: string,
  picId: number,
  picName: string,
): string {
  const escaped = marker.replace(/[[\]]/g, "\\$&");
  // Match a <w:r> (with optional <w:rPr>) whose <w:t> contains only the marker
  const pattern = new RegExp(
    `<w:r(?:\\s[^>]*)?>(?:<w:rPr>[\\s\\S]*?</w:rPr>\\s*)?<w:t(?:[^>]*)?>\\s*${escaped}\\s*</w:t>\\s*</w:r>`,
    "g",
  );
  return xml.replace(pattern, makeDrawingXml(rId, picId, picName));
}

export function embedSignaturesInDocx(
  docxBuffer: Buffer,
  landlordSig: string | null,
  tenantSig: string | null,
): Buffer {
  if (!landlordSig && !tenantSig) return docxBuffer;

  const zip = new PizZip(docxBuffer);
  let docXml = zip.file("word/document.xml")!.asText();
  let relsXml = zip.file("word/_rels/document.xml.rels")!.asText();

  const entries: Array<{
    sig: string;
    marker: string;
    rId: string;
    mediaPath: string;
    picId: number;
    picName: string;
  }> = [];

  if (landlordSig) {
    entries.push({
      sig: landlordSig,
      marker: SIG_LANDLORD,
      rId: "rId_sig_landlord",
      mediaPath: "word/media/sig_landlord.png",
      picId: 200,
      picName: "sig_landlord",
    });
  }
  if (tenantSig) {
    entries.push({
      sig: tenantSig,
      marker: SIG_TENANT,
      rId: "rId_sig_tenant",
      mediaPath: "word/media/sig_tenant.png",
      picId: 201,
      picName: "sig_tenant",
    });
  }

  for (const { sig, marker, rId, mediaPath, picId, picName } of entries) {
    zip.file(mediaPath, dataUrlToBuffer(sig));
    const rel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaPath.replace("word/", "")}"/>`;
    relsXml = relsXml.replace("</Relationships>", `${rel}</Relationships>`);
    docXml = replaceMarkerWithDrawing(docXml, marker, rId, picId, picName);
  }

  zip.file("word/document.xml", docXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  return zip.generate({ type: "nodebuffer" }) as Buffer;
}
