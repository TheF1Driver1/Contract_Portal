import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS_ES } from "@/lib/legal-content";
import { bilingualMetadata } from "@/lib/seo";

export const metadata = bilingualMetadata({
  title: TERMS_ES.title,
  description: TERMS_ES.intro,
  esPath: "/terminos",
  enPath: "/en/terms",
  locale: "es",
});

export default function Page() {
  return <LegalPage doc={TERMS_ES} lang="es" />;
}
