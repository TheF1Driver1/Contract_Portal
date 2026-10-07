import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS_ES } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Términos de servicio — ContractOS" };

export default function Page() {
  return <LegalPage doc={TERMS_ES} lang="es" />;
}
