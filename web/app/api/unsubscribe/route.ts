import { NextResponse } from "next/server";
import { optOutLifecycle } from "@/lib/lifecycle/optout";

export const dynamic = "force-dynamic";

// RFC 8058 one-click unsubscribe: mail clients POST here without user interaction.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const ok = await optOutLifecycle(url.searchParams.get("u"), url.searchParams.get("s")).catch(() => null);
  if (ok === null) return NextResponse.json({ error: "failed" }, { status: 500 });
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "invalid" }, { status: 400 });
}
