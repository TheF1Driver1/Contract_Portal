import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS_EN } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Terms of Service — ContractOS" };

export default function Page() {
  return <LegalPage doc={TERMS_EN} lang="en" />;
}
