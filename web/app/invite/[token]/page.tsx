import Link from "next/link";
export const dynamic = 'force-dynamic';

import { getTranslations } from "next-intl/server";
import { XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthStatusIcon } from "@/components/auth/AuthShell";
import InviteSignupClient from "./InviteSignupClient";

interface InviteData {
  tenantEmail: string;
  tenantName: string;
  contractId: string;
  propertyName: string;
}

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const admin = createAdminClient();
  const t = await getTranslations("invite");

  const { data: invite } = await admin
    .from("tenant_invites")
    .select("tenant_email, tenant_name, used, expires_at, contract_id, contract:contracts(property:properties(name))")
    .eq("token", params.token)
    .single();

  const expired = !invite || invite.used || new Date(invite.expires_at) < new Date();

  if (expired) {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="danger">
            <XCircle />
          </AuthStatusIcon>
        }
        title={t("tenant.expiredTitle")}
        description={t("tenant.expiredDescription")}
      >
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/">{t("home")}</Link>
        </Button>
      </AuthShell>
    );
  }

  const property = (invite.contract as unknown as { property: { name: string } | null } | null)?.property;

  const data: InviteData = {
    tenantEmail: invite.tenant_email,
    tenantName: invite.tenant_name,
    contractId: invite.contract_id,
    propertyName: property?.name ?? t("tenant.propertyFallback"),
  };

  return <InviteSignupClient {...data} token={params.token} />;
}
