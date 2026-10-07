import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_ES } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Política de privacidad — ContractOS" };

export default function Page() {
  return <LegalPage doc={PRIVACY_ES} lang="es" />;
}
