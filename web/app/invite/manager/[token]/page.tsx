import Link from "next/link";
export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthStatusIcon } from "@/components/auth/AuthShell";
import ManagerInviteClient from "./ManagerInviteClient";

export default async function ManagerInvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const admin = createAdminClient();
  const t = await getTranslations("invite");

  const { data: invite } = await admin
    .from("property_managers")
    .select("id, manager_email, status, owner_id, property_ids, invited_at")
    .eq("invite_token", params.token)
    .single();

  if (!invite || invite.status !== "pending") {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="danger">
            <XCircle />
          </AuthStatusIcon>
        }
        title={t("manager.unavailableTitle")}
        description={t("manager.unavailableDescription")}
      >
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/">{t("home")}</Link>
        </Button>
      </AuthShell>
    );
  }

  // Fetch owner profile for display
  const { data: owner } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", invite.owner_id)
    .single();

  // Fetch property names
  const { data: properties } = await admin
    .from("properties")
    .select("id, name, address")
    .in("id", invite.property_ids as string[]);

  return (
    <ManagerInviteClient
      token={params.token}
      managerEmail={invite.manager_email}
      ownerName={owner?.full_name || owner?.email || t("manager.ownerFallback")}
      properties={properties ?? []}
    />
  );
}
