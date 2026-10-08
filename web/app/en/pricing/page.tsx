import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { PricingPage } from "@/components/marketing/PricingPage";
import { bilingualMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations({ locale: "en", namespace: "pricing.meta" });
  return bilingualMetadata({ title: t("title"), description: t("description"), esPath: "/pricing", enPath: "/en/pricing", locale: "en" });
}

export default async function PricingEn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <PricingPage locale="en" signedIn={!!user} />;
}
