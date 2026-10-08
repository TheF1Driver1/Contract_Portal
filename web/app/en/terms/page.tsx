import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS_EN } from "@/lib/legal-content";
import { bilingualMetadata } from "@/lib/seo";

export const metadata = bilingualMetadata({
  title: TERMS_EN.title,
  description: TERMS_EN.intro,
  esPath: "/terminos",
  enPath: "/en/terms",
  locale: "en",
});

export default function Page() {
  return <LegalPage doc={TERMS_EN} lang="en" />;
}
