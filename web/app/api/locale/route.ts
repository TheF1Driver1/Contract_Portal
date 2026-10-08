import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const LocaleSchema = z.object({ locale: z.enum(["es", "en"]) });

/** Saves the user's UI language on their profile and in the NEXT_LOCALE cookie. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = LocaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { locale } = parsed.data;

  const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
