import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_ES } from "@/lib/legal-content";
import { bilingualMetadata } from "@/lib/seo";

export const metadata = bilingualMetadata({
  title: PRIVACY_ES.title,
  description: PRIVACY_ES.intro,
  esPath: "/privacidad",
  enPath: "/en/privacy",
  locale: "es",
});

export default function Page() {
  return <LegalPage doc={PRIVACY_ES} lang="es" />;
}
