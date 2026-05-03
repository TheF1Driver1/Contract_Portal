import { createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { GeocodeSchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = GeocodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, lat, lng } = parsed.data;
  const { error } = await supabase
    .from("properties")
    .update({ latitude: lat, longitude: lng })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
