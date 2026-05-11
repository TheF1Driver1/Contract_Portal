import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitRead } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { data, error } = await supabase
    .from("contract_notification_logs")
    .select("*")
    .eq("contract_id", params.id)
    .eq("owner_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
