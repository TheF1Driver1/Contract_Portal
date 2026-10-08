import { aiEnabled } from "@/lib/ai/client";
import { SectionTemplates } from "@/components/settings/SectionTemplates";

export default function SectionTemplatesPage() {
  return <SectionTemplates aiTranslate={aiEnabled()} />;
}
