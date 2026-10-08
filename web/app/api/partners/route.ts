import { NextResponse } from "next/server";
import { PartnerApplicationSchema } from "@/lib/schemas";
import { rateLimitPublic } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/esign/service";
import { sendResendEmail } from "@/lib/notify";
import { emailLayout } from "@/lib/emails/layout";
import { trackEvent } from "@/lib/analytics";

const KIND_LABEL = { realtor: "Corredor de bienes raíces", property_manager: "Administrador de propiedades", cpa: "Contador / CPA", other: "Otro" } as const;

// Public partner-program application (Plan 37). Emails the team; stores nothing.
export async function POST(req: Request) {
  const limited = await rateLimitPublic(requestMeta(req).ip ?? "unknown");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  // A filled honeypot gets the same success response, so bots learn nothing.
  if (body && typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }
  const parsed = PartnerApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const p = parsed.data;
  const subject = `Solicitud de socio: ${p.company || p.name} (${KIND_LABEL[p.kind]})`;

  const html = emailLayout({
    lang: "es",
    heading: subject,
    paragraphs: [
      `Nombre: ${p.name}`,
      `Correo: ${p.email}`,
      `Teléfono: ${p.phone || "—"}`,
      `Empresa: ${p.company || "—"}`,
      `Tipo: ${KIND_LABEL[p.kind]}`,
      `Propietarios que atiende: ${p.clients ?? "—"}`,
      `Idioma: ${p.locale}`,
      ...(p.message ? [p.message] : []),
    ],
    footer: "Enviado desde el formulario del programa de socios de ContractOS.",
  });

  try {
    await sendResendEmail(process.env.CONTACT_EMAIL ?? "hola@prcontract.online", subject, html, undefined, { "Reply-To": p.email });
  } catch {
    return NextResponse.json({ ok: false, error: "send" }, { status: 502 });
  }

  await trackEvent("partner_applied", { kind: p.kind, locale: p.locale });
  return NextResponse.json({ ok: true });
}
