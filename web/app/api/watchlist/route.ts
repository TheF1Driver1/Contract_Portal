import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { error } = await supabase.from("watchlist").upsert(
    { owner_id: user.id, ...body },
    { onConflict: "owner_id,zillow_id" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { zillow_id } = await req.json()
  await supabase.from("watchlist").delete().eq("owner_id", user.id).eq("zillow_id", zillow_id)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data } = await supabase
    .from("watchlist")
    .select("*")
    .eq("owner_id", user.id)
    .order("saved_at", { ascending: false })
  return NextResponse.json(data ?? [])
}
