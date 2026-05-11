import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { NotificationTriggerCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { data, error } = await supabase
    .from("notification_triggers")
    .select("*")
    .eq("owner_id", user.id)
    .order("days_before", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = NotificationTriggerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notification_triggers")
    .insert({ ...parsed.data, owner_id: user.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A trigger for ${parsed.data.days_before} days already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
