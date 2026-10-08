import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";
import { reissueLink } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";

const Body = z.object({ mode: z.enum(["resend", "in_person"]) });

/**
 * resend: new link sent to the signer. in_person: a link to open on the
 * landlord's device; the signer still verifies with a code sent to them.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; signerId: string }> }) {
  const { signerId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    const inPerson = parsed.data.mode === "in_person";
    const { url } = await reissueLink(createAdminClient(), { signerId, ownerId: user.id, appUrl: appUrl(req), inPerson, notify: !inPerson });
    return NextResponse.json(inPerson ? { url } : { ok: true });
  } catch (e) {
    return signErrorResponse(e);
  }
}
