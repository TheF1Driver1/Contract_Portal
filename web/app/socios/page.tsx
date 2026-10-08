import { getTranslations } from "next-intl/server";
import { PartnersPage } from "@/components/marketing/PartnersPage";
import { bilingualMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations({ locale: "es", namespace: "referrals.partners" });
  return bilingualMetadata({ title: t("metaTitle"), description: t("subtitle"), esPath: "/socios", enPath: "/en/partners", locale: "es" });
}

export default function Page() {
  return <PartnersPage locale="es" />;
}
