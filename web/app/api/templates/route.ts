import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimitStrict } from "@/lib/rate-limit";
import { TemplateCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Service role client — used only for storage uploads (bypasses RLS; auth verified before use)
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const BUCKET = "contract-templates";

// GET /api/templates — list owner's templates
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/templates — upload a new .docx template
export async function POST(req: Request) {
  try {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  console.log("[templates POST] parsing formData");
  const formData = await req.formData();
  console.log("[templates POST] formData keys:", [...formData.keys()]);
  const file = formData.get("file") as File | null;
  const metaRaw = formData.get("meta") as string | null;
  console.log("[templates POST] file:", file?.name, file?.size, file?.type, "metaRaw:", metaRaw);

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== ALLOWED_MIME && !file.name.endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx files allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });
  }

  const meta = TemplateCreateSchema.safeParse(metaRaw ? JSON.parse(metaRaw) : {});
  if (!meta.success) {
    return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
  }

  // If setting as default, clear existing default for this type first
  if (meta.data.is_default) {
    await supabase
      .from("contract_templates")
      .update({ is_default: false })
      .eq("owner_id", user.id)
      .eq("contract_type", meta.data.contract_type)
      .eq("is_default", true);
  }

  // Insert DB record first to get ID for storage path
  const { data: record, error: insertErr } = await supabase
    .from("contract_templates")
    .insert({
      owner_id: user.id,
      name: meta.data.name,
      description: meta.data.description ?? null,
      contract_type: meta.data.contract_type,
      is_default: meta.data.is_default,
      file_url: "", // placeholder, updated after upload
    })
    .select("id")
    .single();

  if (insertErr || !record) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const storagePath = `${user.id}/${record.id}.docx`;
  const bytes = await file.arrayBuffer();
  const admin = adminClient();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: ALLOWED_MIME,
      upsert: true,
    });

  if (uploadErr) {
    await supabase.from("contract_templates").delete().eq("id", record.id);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

  await supabase
    .from("contract_templates")
    .update({ file_url: publicUrl })
    .eq("id", record.id);

  const { data: full } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("id", record.id)
    .single();

  return NextResponse.json(full, { status: 201 });
  } catch (err) {
    console.error("[templates POST] unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
