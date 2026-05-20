import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { ContractAttachmentCreateSchema } from "@/lib/schemas";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  // Verify contract ownership
  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("contract_attachments")
    .select("*")
    .eq("contract_id", params.id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate 1-hour signed URLs
  const supabaseAdmin = createAdminClient();
  const withUrls = await Promise.all(
    (data ?? []).map(async (att) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("contracts")
        .createSignedUrl(att.storage_path, 3600);
      return { ...att, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(withUrls);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  // Verify contract ownership
  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const parsed = ContractAttachmentCreateSchema.safeParse({
    name: file.name,
    storage_path: `${user.id}/attachments/${params.id}/${Date.now()}_${file.name}`,
    file_size: file.size,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(parsed.data.storage_path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("contract_attachments")
    .insert({
      contract_id: params.id,
      owner_id: user.id,
      name: parsed.data.name,
      storage_path: parsed.data.storage_path,
      file_size: parsed.data.file_size,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
