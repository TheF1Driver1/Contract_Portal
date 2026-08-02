"use client";

import { useState, useEffect, useRef } from "react";
import {
  Paperclip,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Upload,
  Pencil,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import type { ContractAttachment, ContractCustomSection, UserSectionTemplate } from "@/lib/types";

interface Props {
  contractId: string;
}

type Tab = "attachments" | "sections";

export default function ContractDocumentsPanel({ contractId }: Props) {
  const [tab, setTab] = useState<Tab>("attachments");

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface-container)" }}>
        {(["attachments", "sections"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              background: tab === t ? "var(--surface-card)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t === "attachments" ? <Paperclip className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "attachments" && <AttachmentsTab contractId={contractId} />}
      {tab === "sections"    && <SectionsTab    contractId={contractId} />}
    </div>
  );
}

// ── Attachments ───────────────────────────────────────────────────────────────

function AttachmentsTab({ contractId }: { contractId: string }) {
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/attachments`)
      .then(async (r) => { if (r.ok) setAttachments(await r.json()); })
      .catch(() => {});
  }, [contractId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Only PDF files accepted"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Max file size is 10 MB"); return; }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/attachments`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
      setAttachments((prev) => [...prev, data]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/contracts/${contractId}/attachments/${id}`, { method: "DELETE" });
    if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
          No attachments yet
        </p>
      )}

      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ background: "var(--surface-low)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: "#10b981" }} />
            {att.signed_url ? (
              <a
                href={att.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium truncate underline-offset-2 hover:underline"
                style={{ color: "var(--text-primary)" }}
              >
                {att.name}
              </a>
            ) : (
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {att.name}
              </span>
            )}
            {att.file_size && (
              <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                {(att.file_size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
          <button
            onClick={() => handleDelete(att.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(255,59,48,0.1)" }}
          >
            <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff3b30" }} />
          </button>
        </div>
      ))}

      {error && (
        <p className="text-xs rounded-lg p-2" style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}>
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5 w-full justify-center border-2 border-dashed transition-colors disabled:opacity-50"
        style={{
          borderColor: "var(--surface-container)",
          color: "var(--text-muted)",
          background: "transparent",
        }}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Upload PDF"}
      </button>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function SectionsTab({ contractId }: { contractId: string }) {
  const [sections,  setSections]  = useState<ContractCustomSection[]>([]);
  const [templates, setTemplates] = useState<UserSectionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTitle, setNewTitle]   = useState("");
  const [newBody,  setNewBody]    = useState("");
  const [adding,   setAdding]     = useState(false);
  const [editId,   setEditId]     = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody,  setEditBody]  = useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/sections`)
      .then(async (r) => { if (r.ok) setSections(await r.json()); })
      .catch(() => {});
    fetch("/api/user-sections")
      .then(async (r) => { if (r.ok) setTemplates(await r.json()); })
      .catch(() => {});
  }, [contractId]);

  async function addSection(title: string, body: string) {
    if (!title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections((prev) => [...prev, data]);
        setNewTitle("");
        setNewBody("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections((prev) => prev.map((s) => (s.id === id ? data : s)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section?")) return;
    const res = await fetch(`/api/contracts/${contractId}/sections/${id}`, { method: "DELETE" });
    if (res.ok) setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function startEdit(sec: ContractCustomSection) {
    setEditId(sec.id);
    setEditTitle(sec.title);
    setEditBody(sec.body);
  }

  return (
    <div className="space-y-3">
      {/* Existing sections */}
      {sections.length === 0 && !showTemplates && (
        <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
          No custom sections yet
        </p>
      )}

      {sections.map((sec) => (
        <div
          key={sec.id}
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--surface-low)" }}
        >
          {editId === sec.id ? (
            <>
              <input
                className="input-tonal w-full text-sm font-semibold"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Section title"
              />
              <textarea
                className="input-tonal w-full text-sm resize-none"
                rows={4}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder="Section content…"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(sec.id)}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#10b981", color: "#fff" }}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {sec.title}
                </p>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(sec)}
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{ background: "var(--surface-container)" }}
                  >
                    <Pencil className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                  </button>
                  <button
                    onClick={() => deleteSection(sec.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{ background: "rgba(255,59,48,0.1)" }}
                  >
                    <Trash2 className="h-3 w-3" style={{ color: "#ff3b30" }} />
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                {sec.body || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Empty</span>}
              </p>
            </>
          )}
        </div>
      ))}

      {/* Template picker */}
      {showTemplates && templates.length > 0 && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--surface-low)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Add from template
          </p>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={async () => {
                await addSection(t.title, t.body);
                setShowTemplates(false);
              }}
              className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {t.title}
            </button>
          ))}
          <button
            onClick={() => setShowTemplates(false)}
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Add section form */}
      <div className="rounded-xl p-4 space-y-3" style={{ border: "1.5px dashed var(--surface-container)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          New section
        </p>
        <input
          className="input-tonal w-full text-sm"
          placeholder="Section title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <textarea
          className="input-tonal w-full text-sm resize-none"
          rows={3}
          placeholder="Section content…"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => addSection(newTitle, newBody)}
            disabled={adding || !newTitle.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: "#10b981", color: "#fff" }}
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add Section
          </button>
          {templates.length > 0 && (
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
            >
              <BookOpen className="h-3 w-3" />
              From template
            </button>
          )}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Sections appear in the generated PDF before the signature block.{" "}
        <a href="/settings/sections" className="underline" style={{ color: "#10b981" }}>
          Manage templates →
        </a>
      </p>
    </div>
  );
}
