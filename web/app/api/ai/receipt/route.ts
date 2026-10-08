import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { getPlan } from "@/lib/entitlements";
import { aiEnabled } from "@/lib/ai/client";
import { aiQuotaRemaining, recordAiUsage } from "@/lib/ai/usage";
import { extractReceipt, ReceiptError, RECEIPT_MAX_BYTES, RECEIPT_MEDIA_TYPES, type ReceiptMediaType } from "@/lib/ai/receipt";

export const maxDuration = 60;

/**
 * Reads a receipt photo or PDF and returns a draft expense for the form.
 * Nothing is saved here: the landlord reviews the fields and saves as usual.
 * The file is sent to the model and not stored.
 */
export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!(RECEIPT_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (file.size === 0 || file.size > RECEIPT_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const admin = createAdminClient();
  const plan = await getPlan(supabase, user.id);
  if ((await aiQuotaRemaining(admin, user.id, plan, "receipt")) <= 0) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
  }

  try {
    const { draft, usage } = await extractReceipt({ bytes: Buffer.from(await file.arrayBuffer()), mediaType: file.type as ReceiptMediaType });
    await recordAiUsage(admin, user.id, "receipt", usage);
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof ReceiptError) return NextResponse.json({ error: e.code }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "busy" }, { status: 503 });
    if (e instanceof Anthropic.APIError) {
      // Log status only: never the file or extracted content.
      console.error(JSON.stringify({ level: "error", msg: "receipt extraction failed", status: e.status }));
      return NextResponse.json({ error: "ai_failed" }, { status: 502 });
    }
    throw e;
  }
}
