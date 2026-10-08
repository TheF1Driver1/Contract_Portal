import { getTranslations } from "next-intl/server";
import { ContactPage } from "@/components/marketing/ContactPage";
import { bilingualMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations({ locale: "es", namespace: "marketing.contact" });
  return bilingualMetadata({ title: t("metaTitle"), description: t("subtitle"), esPath: "/contacto", enPath: "/en/contact", locale: "es" });
}

export default function Page() {
  return <ContactPage locale="es" />;
}
