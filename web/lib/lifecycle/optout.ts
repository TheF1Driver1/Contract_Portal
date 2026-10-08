import { createAdminClient } from "@/lib/supabase-server";
import { verifyUnsubscribe } from "@/lib/lifecycle/unsubscribe";

/** Turns off lifecycle emails for a signed link. Returns false for a bad signature. */
export async function optOutLifecycle(userId: string | null | undefined, sig: string | null | undefined): Promise<boolean> {
  if (!verifyUnsubscribe(userId, sig)) return false;
  const { error } = await createAdminClient().from("profiles").update({ lifecycle_emails: false }).eq("id", userId!);
  if (error) throw new Error(error.message);
  return true;
}
