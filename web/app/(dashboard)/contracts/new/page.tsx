import { createAdminClient, createClient } from "@/lib/supabase-server";
import ContractBuilder from "@/components/ContractBuilder";
import { aiEnabled } from "@/lib/ai/client";
import { redirect } from "next/navigation";
import type { Property, Tenant, ContractTemplate, Contract } from "@/lib/types";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { loadSignature } from "@/lib/esign/signature-store";

// Uses the admin client (signature images in private storage).
export const dynamic = "force-dynamic";

export default async function NewContractPage(
  props: {
    searchParams: Promise<{ edit?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const editId = searchParams.edit ?? null;

  const [{ data: properties }, { data: tenants }, { data: profile }, { data: templates }] = await Promise.all([
    supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    supabase.from("tenants").select("*").eq("owner_id", user.id).order("full_name"),
    supabase.from("profiles").select("email").eq("id", user.id).single(),
    supabase.from("contract_templates").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);

  let draftContract: Contract | null = null;
  if (editId) {
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", editId)
      .eq("owner_id", user.id)
      .eq("status", "draft")
      .single();
    draftContract = (data as Contract | null) ?? null;
    // The builder's signature pad needs the image itself, not the storage reference.
    if (draftContract?.landlord_signature) {
      draftContract = { ...draftContract, landlord_signature: (await loadSignature(createAdminClient(), draftContract.landlord_signature, user.id)) ?? "" };
    }
  }

  const landlordEmail = (profile as { email?: string } | null)?.email ?? user.email ?? "";
  const isEditing = !!draftContract;
  const t = await getTranslations("builder.page");

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? t("editTitle") : t("newTitle")}
        description={isEditing ? t("editDescription") : t("newDescription")}
      />

      {(!properties?.length || !tenants?.length) && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-warning-soft p-4 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-semibold">{t("missingTitle")}</p>
            {!properties?.length && (
              <p>
                {t("missingProperty")}{" "}
                <Link href="/properties" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("addProperty")}
                </Link>
              </p>
            )}
            {!tenants?.length && (
              <p>
                {t("missingTenant")}{" "}
                <Link href="/tenants" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("addTenant")}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      <ContractBuilder
        properties={(properties ?? []) as Property[]}
        tenants={(tenants ?? []) as Tenant[]}
        templates={(templates ?? []) as ContractTemplate[]}
        userId={user.id}
        landlordEmail={landlordEmail}
        initialData={draftContract}
        aiTranslate={aiEnabled()}
      />
    </div>
  );
}
