import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_EN } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Privacy Policy — ContractOS" };

export default function Page() {
  return <LegalPage doc={PRIVACY_EN} lang="en" />;
}
