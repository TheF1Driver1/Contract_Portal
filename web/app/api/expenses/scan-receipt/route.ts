import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

async function extractFromAzure(buffer: Buffer, mimeType: string): Promise<Record<string, unknown>> {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) return {};

  // Submit image for analysis
  const submitRes = await fetch(
    `${endpoint}/formrecognizer/documentModels/prebuilt-receipt:analyze?api-version=2023-07-31`,
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": mimeType },
      body: buffer,
    }
  );
  if (!submitRes.ok) return {};

  const operationUrl = submitRes.headers.get("Operation-Location");
  if (!operationUrl) return {};

  // Poll until succeeded (typically 1–3 s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(operationUrl, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!pollRes.ok) break;
    const data = await pollRes.json();
    if (data.status === "failed") break;
    if (data.status !== "succeeded") continue;

    const doc = data.analyzeResult?.documents?.[0];
    if (!doc) return {};
    const f = doc.fields ?? {};

    const rawAmount = f.Total?.valueCurrency?.amount ?? Number(f.Total?.content?.replace(/[^0-9.]/g, "")) ?? null;
    const amount = rawAmount && !isNaN(Number(rawAmount)) ? Number(rawAmount) : null;
    const vendor: string | null = f.MerchantName?.content ?? null;
    const rawDate: string | null = f.TransactionDate?.valueDate ?? f.TransactionDate?.content ?? null;
    const expense_date = rawDate ? rawDate.slice(0, 10) : null;
    const category = docTypeToCategory(doc.docType as string | undefined);

    return { amount, vendor, expense_date, category, description: null };
  }

  return {};
}

function docTypeToCategory(docType: string | undefined): string | null {
  if (!docType) return null;
  if (docType.includes("gas")) return "utilities";
  if (docType.includes("hotel") || docType.includes("lodging")) return "management";
  return null;
}

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

  const extracted = await extractFromAzure(buffer, file.type);

  return NextResponse.json({
    storage_path: storagePath,
    preview_url: signedData?.signedUrl ?? null,
    extracted,
  });
}
