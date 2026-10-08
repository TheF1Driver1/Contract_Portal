import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-server";
import { rateLimitPublic, rateLimitStrict } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";
import { decline, recordConsent, requestMeta, sendCode, sign, signerFromToken, verifyCode } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";
import { trackEvent } from "@/lib/analytics";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), text: z.string().min(10).max(2000) }),
  z.object({ action: z.literal("send_code"), channel: z.enum(["sms", "email"]) }),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\s*\d{6}\s*$/) }),
  z.object({
    action: z.literal("sign"),
    signature: z.string().max(600_000),
    method: z.enum(["drawn", "typed"]),
    typedName: z.string().max(200).optional(),
    intent: z.literal(true),
  }),
  z.object({ action: z.literal("decline"), reason: z.string().max(1000).default("") }),
]);

/** Public signing endpoint; the token in the URL is the credential. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const meta = requestMeta(req);
  const limited = await rateLimitPublic(meta.ip ?? "unknown");
  if (limited) return limited;

  const parsed = Action.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida.", code: "bad_request" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const session = await signerFromToken(admin, token);
    const body = parsed.data;
    switch (body.action) {
      case "consent":
        await recordConsent(admin, session, meta, body.text);
        return NextResponse.json({ ok: true });
      case "send_code": {
        const otpLimited = await rateLimitStrict(`otp:${session.signer.id}`);
        if (otpLimited) return otpLimited;
        return NextResponse.json(await sendCode(admin, session, body.channel, meta));
      }
      case "verify":
        await verifyCode(admin, session, body.code, meta);
        return NextResponse.json({ ok: true });
      case "sign": {
        const sealed = await sign(admin, session, { signature: body.signature, method: body.method, typedName: body.typedName }, meta, appUrl(req));
        await trackEvent("contract_signed", { channel: session.signer.in_person ? "in_person" : "remote", sealed });
        return NextResponse.json({ ok: true, sealed });
      }
      case "decline":
        await decline(admin, session, body.reason, meta);
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return signErrorResponse(e);
  }
}
