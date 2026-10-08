import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { receiptFor } from "@/lib/rent/receipt-data";
import { receiptNumber, renderReceipt } from "@/lib/rent/receipt";

export const dynamic = "force-dynamic";

// Landlord download; RLS limits it to the caller's own payments.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await receiptFor(supabase, id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderReceipt(r.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptNumber(r.data.number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
