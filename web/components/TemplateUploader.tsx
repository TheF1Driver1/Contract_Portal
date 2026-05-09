"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Star, Trash2, Download, Loader2 } from "lucide-react";
import type { ContractTemplate } from "@/lib/types";

interface Props {
  templates: ContractTemplate[];
  onUploaded: (t: ContractTemplate) => void;
  onDeleted: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  all: "All types",
  lease: "Lease",
  rental: "Rental",
  addendum: "Addendum",
};

const S = {
  card: "rounded-2xl p-5 space-y-4",
  surface: "var(--surface-low)",
  surfaceMid: "var(--surface-mid)",
  border: "rgba(255,255,255,0.07)",
  text: "var(--text-primary)",
  muted: "var(--text-muted)",
  secondary: "var(--text-secondary)",
  accent: "#007aff",
};

export default function TemplateUploader({ templates, onUploaded, onDeleted, onSetDefault }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contract_type: "all", is_default: false });

  async function upload(file: File) {
    if (!file.name.endsWith(".docx")) {
      setError("Only .docx files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("meta", JSON.stringify({
        name: form.name || file.name.replace(/\.docx$/i, ""),
        contract_type: form.contract_type,
        is_default: form.is_default,
      }));

      const res = await fetch("/api/templates", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const created: ContractTemplate = await res.json();
      onUploaded(created);
      setForm({ name: "", contract_type: "all", is_default: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) onDeleted(id);
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (res.ok) onSetDefault(id);
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        className={S.card}
        style={{ background: S.surface, border: `1px solid ${dragging ? S.accent : S.border}` }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
          Upload Template
        </p>

        {/* Drop zone */}
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center gap-3 py-8 cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? S.accent : S.border,
            background: dragging ? "rgba(0,122,255,0.06)" : "transparent",
          }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8" style={{ color: S.muted }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: S.text }}>
              Drop your .docx template here
            </p>
            <p className="text-xs mt-1" style={{ color: S.muted }}>
              or click to browse — max 5 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </div>

        {/* Name + type fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: S.secondary }}>
              Template name
            </label>
            <input
              type="text"
              placeholder="e.g. Sabana Gardens Lease"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: S.surfaceMid,
                border: `1px solid ${S.border}`,
                color: S.text,
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: S.secondary }}>
              Contract type
            </label>
            <select
              value={form.contract_type}
              onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: S.surfaceMid,
                border: `1px solid ${S.border}`,
                color: S.text,
              }}
            >
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm" style={{ color: S.secondary }}>
            Set as default template for this contract type
          </span>
        </label>

        {error && (
          <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(255,59,48,0.12)", color: "#ff3b30" }}>
            {error}
          </p>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: S.muted }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </div>
        )}
      </div>

      {/* Template list */}
      {templates.length > 0 && (
        <div
          className={S.card}
          style={{ background: S.surface, border: `1px solid ${S.border}` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
            Your Templates
          </p>
          <div className="space-y-2">
            {templates.map(t => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: S.surfaceMid, border: `1px solid ${S.border}` }}
              >
                <FileText className="h-5 w-5 shrink-0" style={{ color: S.accent }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: S.text }}>
                    {t.name}
                    {t.is_default && (
                      <span
                        className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(0,122,255,0.18)", color: S.accent }}
                      >
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: S.muted }}>
                    {CONTRACT_TYPE_LABELS[t.contract_type] ?? t.contract_type} ·{" "}
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!t.is_default && (
                    <button
                      title="Set as default"
                      onClick={() => setDefault(t.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                      style={{ color: S.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = S.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = S.muted)}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <a
                    href={t.file_url}
                    download
                    title="Download template"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    style={{ color: S.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = S.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = S.muted)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    title="Delete template"
                    onClick={() => deleteTemplate(t.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    style={{ color: S.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ff3b30")}
                    onMouseLeave={e => (e.currentTarget.style.color = S.muted)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
