"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, X, BookOpen } from "lucide-react";
import type { UserSectionTemplate } from "@/lib/types";

export default function SectionTemplatesPage() {
  const [templates, setTemplates] = useState<UserSectionTemplate[]>([]);
  const [newTitle,  setNewTitle]  = useState("");
  const [newBody,   setNewBody]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState("");
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody,  setEditBody]  = useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    fetch("/api/user-sections")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, []);

  async function add() {
    if (!newTitle.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/user-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => [data, ...prev]);
        setNewTitle("");
        setNewBody("");
      } else {
        setAddError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/user-sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => (t.id === id ? data : t)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/user-sections/${id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Settings
        </p>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          Section Templates
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Create reusable contract clauses you can quickly add to any contract
        </p>
      </div>

      {/* New template form */}
      <div className="surface-card space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: "#007aff" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Template</p>
        </div>
        <div className="space-y-3">
          <input
            className="input-tonal w-full"
            placeholder="Section title (e.g. Pet Policy)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="input-tonal w-full resize-none"
            rows={4}
            placeholder="Section content…"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <button
            onClick={add}
            disabled={adding || !newTitle.trim()}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
            style={{ background: "#007aff", color: "#fff" }}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Template
          </button>
          {addError && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}>
              {addError}
            </p>
          )}
        </div>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="surface-card text-center py-8">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No templates yet</p>
          </div>
        )}

        {templates.map((t) => (
          <div key={t.id} className="surface-card space-y-3">
            {editId === t.id ? (
              <>
                <input
                  className="input-tonal w-full font-semibold"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <textarea
                  className="input-tonal w-full resize-none"
                  rows={5}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(t.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: "#007aff", color: "#fff" }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl"
                    style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.title}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditId(t.id); setEditTitle(t.title); setEditBody(t.body); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ background: "var(--surface-container)" }}
                    >
                      <Pencil className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ background: "rgba(255,59,48,0.1)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff3b30" }} />
                    </button>
                  </div>
                </div>
                {t.body && (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {t.body}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
