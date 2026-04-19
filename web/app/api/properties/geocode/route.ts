import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { id, lat, lng } = await req.json()
  const supabase = createClient()
  const { error } = await supabase
    .from("properties")
    .update({ latitude: lat, longitude: lng })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
