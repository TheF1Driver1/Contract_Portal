export const dynamic = 'force-dynamic';

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import TenantSigningClient from "./TenantSigningClient";
import type { Contract } from "@/lib/types";

export default async function TenantSignPage(props: { params: Promise<{ contractId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Verify the tenant has a redeemed invite for this contract
  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id")
    .eq("contract_id", params.contractId)
    .eq("used_by", user.id)
    .eq("used", true)
    .single();

  if (!invite) notFound();

  const { data: contract } = await admin
    .from("contracts")
    .select("*, property:properties(name, address, city, state), tenant:tenants(full_name)")
    .eq("id", params.contractId)
    .single();

  if (!contract) notFound();

  const t = await getTranslations("portal");

  const backLink = (
    <Button asChild variant="ghost" size="lg" className="-ml-3 mb-4 px-3 text-muted-foreground">
      <Link href="/portal">
        <ArrowLeft aria-hidden />
        {t("signing.back")}
      </Link>
    </Button>
  );

  if (contract.status === "signed") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        {backLink}
        <div className="rounded-xl border border-border bg-surface p-5 text-center md:p-8">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-foreground">{t("signing.signedTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("signing.signedDescription")}</p>
          {contract.tenant_signature && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("signing.yourSignature")}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contract.tenant_signature}
                alt={t("signing.yourSignature")}
                className="mx-auto max-h-24 rounded-lg border border-border bg-surface-muted p-2"
              />
            </div>
          )}
          {contract.pdf_url && (
            <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
              <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer" download>
                <Download aria-hidden />
                {t("actions.download")}
              </a>
            </Button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 md:pt-10">
      {backLink}
      <TenantSigningClient contract={contract as unknown as Contract} />
    </main>
  );
}
