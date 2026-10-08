import { NextResponse } from "next/server";
import { ContactSchema } from "@/lib/schemas";
import { rateLimitPublic } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/esign/service";
import { sendResendEmail } from "@/lib/notify";
import { emailLayout } from "@/lib/emails/layout";
import { trackEvent } from "@/lib/analytics";

// Public sales inquiry (Enterprise / property managers). Emails the team.
export async function POST(req: Request) {
  const limited = await rateLimitPublic(requestMeta(req).ip ?? "unknown");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  // A filled honeypot gets the same success response, so bots learn nothing.
  if (body && typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const c = parsed.data;

  const html = emailLayout({
    lang: "es",
    heading: `Consulta Enterprise: ${c.company || c.name}`,
    paragraphs: [
      `Nombre: ${c.name}`,
      `Correo: ${c.email}`,
      `Empresa: ${c.company || "—"}`,
      `Unidades: ${c.units ?? "—"}`,
      `Idioma: ${c.locale}`,
      c.message,
    ],
    footer: "Enviado desde el formulario de contacto de ContractOS.",
  });

  try {
    await sendResendEmail(
      process.env.CONTACT_EMAIL ?? "hola@prcontract.online",
      `Consulta Enterprise: ${c.company || c.name}`,
      html,
      undefined,
      { "Reply-To": c.email }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "send" }, { status: 502 });
  }

  await trackEvent("contact_submitted", { units: c.units ?? 0, locale: c.locale });
  return NextResponse.json({ ok: true });
}
