import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { requestMeta, voidAndReissue } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";

const Body = z.object({ reason: z.string().trim().min(3).max(1000) });

/** "Anular y reemitir": void a sent or signed contract and open an editable copy. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Escribe el motivo de la anulación." }, { status: 400 });
  try {
    const newId = await voidAndReissue(createAdminClient(), {
      contractId: id,
      ownerId: user.id,
      ownerEmail: user.email ?? null,
      reason: parsed.data.reason,
      meta: requestMeta(req),
    });
    return NextResponse.json({ newContractId: newId });
  } catch (e) {
    return signErrorResponse(e);
  }
}
