"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import TemplateUploader from "@/components/TemplateUploader";
import type { ContractTemplate } from "@/lib/types";

const S = {
  border: "rgba(255,255,255,0.07)",
  muted: "var(--text-muted)",
  accent: "#007aff",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []));
  }, []);

  function handleUploaded(t: ContractTemplate) {
    setTemplates(prev => [t, ...prev]);
  }

  function handleDeleted(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  function handleSetDefault(id: string) {
    setTemplates(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;
      return prev.map(t => ({
        ...t,
        is_default: t.contract_type === target.contract_type ? t.id === id : t.is_default,
      }));
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Contract Templates
          </h1>
          <p className="text-sm mt-1" style={{ color: S.muted }}>
            Upload your own .docx template. The system fills in contract data automatically.
          </p>
        </div>
        <Link
          href="/settings/templates/guide"
          className="flex items-center gap-1.5 text-sm font-medium rounded-xl px-3 py-2 transition-colors"
          style={{
            border: `1px solid ${S.border}`,
            color: S.accent,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,122,255,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Variable Guide
        </Link>
      </div>

      <TemplateUploader
        templates={templates}
        onUploaded={handleUploaded}
        onDeleted={handleDeleted}
        onSetDefault={handleSetDefault}
      />
    </div>
  );
}
