import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-server";
import { rateLimitPublic, rateLimitStrict } from "@/lib/rate-limit";
import { renderContractPdf } from "@/lib/pdf-react";
import { requestMeta, signerFromToken } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";
import { getPlan } from "@/lib/entitlements";
import { askLease, LeaseHelpError, leaseHelpEnabled } from "@/lib/ai/lease-help";
import { aiQuotaRemaining, recordAiUsage } from "@/lib/ai/usage";

export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().max(300).nullable().optional(),
  lang: z.enum(["es", "en"]).default("es"),
});

/** Plain-language answers about the lease the signer is reviewing. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!leaseHelpEnabled()) return NextResponse.json({ error: "ai_disabled" }, { status: 404 });
  const { token } = await ctx.params;
  const limited = (await rateLimitPublic(requestMeta(req).ip ?? "unknown")) ?? (await rateLimitStrict(`lease-help:${token}`));
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const { agreement } = await signerFromToken(admin, token);
    const c = agreement.contract;
    // The landlord's plan pays for it.
    const plan = await getPlan(admin, c.owner_id);
    if ((await aiQuotaRemaining(admin, c.owner_id, plan, "clause_explain")) <= 0) {
      return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
    }
    const pdf = await renderContractPdf(c, agreement.profile, agreement.clauses);
    if (!pdf) return NextResponse.json({ error: "ai_failed" }, { status: 500 });
    const { answer, usage } = await askLease({ pdf, lang: parsed.data.lang, question: parsed.data.question ?? null });
    await recordAiUsage(admin, c.owner_id, "clause_explain", usage);
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof LeaseHelpError) return NextResponse.json({ error: e.code }, { status: 422 });
    if (e instanceof Anthropic.APIError) {
      console.error(JSON.stringify({ level: "error", msg: "lease help failed", status: e.status }));
      return NextResponse.json({ error: "ai_failed" }, { status: 502 });
    }
    return signErrorResponse(e);
  }
}
