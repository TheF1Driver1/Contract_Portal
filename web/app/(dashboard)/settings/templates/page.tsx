"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import TemplateUploader from "@/components/TemplateUploader";
import type { ContractTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/settings/SectionHeader";

export default function TemplatesPage() {
  const t = useTranslations("settings.templatesPage");
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleUploaded(tpl: ContractTemplate) {
    setTemplates((prev) => [tpl, ...prev]);
  }

  function handleDeleted(id: string) {
    setTemplates((prev) => prev.filter((x) => x.id !== id));
  }

  function handleSetDefault(id: string) {
    setTemplates((prev) => {
      const target = prev.find((x) => x.id === id);
      if (!target) return prev;
      return prev.map((x) => ({
        ...x,
        is_default: x.contract_type === target.contract_type ? x.id === id : x.is_default,
      }));
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="outline" className="h-10 sm:h-9">
            <Link href="/settings/templates/guide">
              <BookOpen aria-hidden />
              {t("guideLink")}
            </Link>
          </Button>
        }
      />

      <TemplateUploader
        templates={templates}
        loading={loading}
        onUploaded={handleUploaded}
        onDeleted={handleDeleted}
        onSetDefault={handleSetDefault}
      />
    </div>
  );
}
