import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_BUCKET = "contract-templates";

/**
 * contract_templates.file_url holds a storage path ("<owner>/<id>.docx").
 * Rows written before the bucket went private hold a public URL; accept both.
 */
export function templatePath(fileUrl: string): string {
  const marker = `/${TEMPLATE_BUCKET}/`;
  const i = fileUrl.indexOf(marker);
  return i >= 0 ? decodeURIComponent(fileUrl.slice(i + marker.length)) : fileUrl;
}

export async function downloadTemplate(
  supabase: SupabaseClient,
  fileUrl: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(templatePath(fileUrl));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function signedTemplateUrl(
  supabase: SupabaseClient,
  fileUrl: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(templatePath(fileUrl), expiresInSeconds);
  return data?.signedUrl ?? null;
}
