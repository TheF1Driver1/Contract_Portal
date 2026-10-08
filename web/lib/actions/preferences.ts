"use server";

import { createClient } from "@/lib/supabase-server";

/** Getting-started tip emails (lifecycle); reminders and contract notices are separate. */
export async function getLifecycleEmails(): Promise<boolean | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("lifecycle_emails").eq("id", user.id).maybeSingle();
  return data?.lifecycle_emails ?? true;
}

export async function setLifecycleEmails(enabled: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("profiles").update({ lifecycle_emails: enabled === true }).eq("id", user.id);
  return { ok: !error };
}
