import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, or WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const storagePath = `${user.id}/${Date.now()}_receipt.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const supabaseAdmin = createAdminClient();
  const { error: uploadError } = await supabaseAdmin.storage
    .from("expense-receipts")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signedData } = await supabaseAdmin.storage
    .from("expense-receipts")
    .createSignedUrl(storagePath, 3600);

  let extracted: Record<string, unknown> = {};

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as "image/jpeg" | "image/png" | "image/webp",
                data: buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: `Extract expense information from this receipt. Reply with ONLY a JSON object, no markdown fences:
{
  "amount": <total amount as a number, or null>,
  "vendor": <merchant/vendor name as a string, or null>,
  "expense_date": <date in "YYYY-MM-DD" format, or null>,
  "category": <one of: maintenance, utilities, insurance, taxes, hoa, repairs, management, advertising, mortgage, other — pick the best match or null>,
  "description": <brief description of what was purchased, or null>
}`,
            },
          ],
        }],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      // Strip optional markdown fences if model includes them
      const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      // Extraction failed — still return the uploaded receipt path
    }
  }

  return NextResponse.json({
    storage_path: storagePath,
    preview_url: signedData?.signedUrl ?? null,
    extracted,
  });
}
