import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { Landing } from "@/components/marketing/Landing";
import { bilingualMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations({ locale: "en", namespace: "marketing.meta" });
  return bilingualMetadata({ title: t("title"), description: t("description"), esPath: "/", enPath: "/en", locale: "en" });
}

export default async function EnglishHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return <Landing locale="en" />;
}
