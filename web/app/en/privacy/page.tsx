import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_EN } from "@/lib/legal-content";
import { bilingualMetadata } from "@/lib/seo";

export const metadata = bilingualMetadata({
  title: PRIVACY_EN.title,
  description: PRIVACY_EN.intro,
  esPath: "/privacidad",
  enPath: "/en/privacy",
  locale: "en",
});

export default function Page() {
  return <LegalPage doc={PRIVACY_EN} lang="en" />;
}
