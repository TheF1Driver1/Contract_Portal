import { createClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { WatchlistUpsertSchema, WatchlistDeleteSchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = WatchlistUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase.from("watchlist").upsert(
    { owner_id: user.id, ...parsed.data },
    { onConflict: "owner_id,zillow_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = WatchlistDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await supabase
    .from("watchlist")
    .delete()
    .eq("owner_id", user.id)
    .eq("zillow_id", parsed.data.zillow_id);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { data } = await supabase
    .from("watchlist")
    .select("*")
    .eq("owner_id", user.id)
    .order("saved_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
