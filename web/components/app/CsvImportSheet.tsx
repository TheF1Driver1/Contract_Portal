"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Download, FileUp, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { createProperty, createTenant, type ActionResult } from "@/lib/actions/records";
import { mapRows, parseCsv, PROPERTY_ALIASES, TENANT_ALIASES } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type ImportKind = "properties" | "tenants";

const MAX_ROWS = 500;

const CONFIG = {
  properties: {
    aliases: PROPERTY_ALIASES,
    required: ["name", "address", "city"],
    preview: ["name", "address", "city", "zip"],
    template: "nombre,direccion,pueblo,estado,zip,unidades,banos\nCasa Playa,Calle Sol 12,Rincón,PR,00677,1,2\n",
    action: createProperty,
  },
  tenants: {
    aliases: TENANT_ALIASES,
    required: ["full_name"],
    preview: ["full_name", "email", "phone"],
    template: "nombre,correo,telefono,idioma\nAna Rivera,ana@example.com,787-555-0101,es\n",
    action: createTenant,
  },
} as const;

const int = (v: string | undefined) => {
  if (!v) return undefined;
  const n = Number.parseInt(v.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

/** CSV row (strings) → the shape the validated server action expects. */
export function toInput(kind: ImportKind, row: Record<string, string>): Record<string, unknown> {
  if (kind === "properties") {
    return {
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state || "PR",
      zip: row.zip,
      unit_count: int(row.unit_count),
      bathroom_count: int(row.bathroom_count),
    };
  }
  const lang = row.preferred_locale?.toLowerCase() ?? "";
  return {
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    license_number: row.license_number,
    current_address: row.current_address,
    preferred_locale: lang.startsWith("en") || lang.startsWith("ing") ? "en" : lang ? "es" : undefined,
  };
}

type Result = { row: number; label: string; ok: boolean; error?: string };

/** Bulk-creates properties or tenants from a CSV (Spanish or English headers). */
export function CsvImportSheet({
  kind,
  open,
  onOpenChange,
}: {
  kind: ImportKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common.csvImport");
  const router = useRouter();
  const cfg = CONFIG[kind];
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const missing = (r: Record<string, string>) => cfg.required.filter((f) => !r[f]);
  const fieldNames = (fields: readonly string[]) => fields.map((f) => t(`col.${f}`)).join(", ");
  const valid = rows.filter((r) => missing(r).length === 0);
  const headerMissing = rows.length > 0 && cfg.required.some((f) => rows.every((r) => !(f in r)));

  function reset() {
    setFileName(null);
    setRows([]);
    setResults(null);
    setProgress(0);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    const mapped = mapRows(parseCsv(await file.text()), cfg.aliases);
    if (mapped.length > MAX_ROWS) toast.warning(t("tooMany", { max: MAX_ROWS }));
    setRows(mapped.slice(0, MAX_ROWS));
  }

  async function runImport() {
    setBusy(true);
    const out: Result[] = [];
    // Sequential: keeps plan-limit checks and rate limits predictable.
    for (const [i, r] of rows.entries()) {
      const label = r[cfg.preview[0]] || t("rowN", { n: i + 2 });
      const gap = missing(r);
      if (gap.length) {
        out.push({ row: i + 2, label, ok: false, error: t("missing", { fields: fieldNames(gap) }) });
      } else {
        const res: ActionResult = await cfg.action(toInput(kind, r)).catch(() => ({ ok: false as const, error: t("failed") }));
        out.push(res.ok ? { row: i + 2, label, ok: true } : { row: i + 2, label, ok: false, error: res.error });
      }
      setProgress(i + 1);
    }
    setResults(out);
    setBusy(false);
    const created = out.filter((r) => r.ok).length;
    if (created) {
      toast.success(t("done", { count: created }));
      router.refresh();
    }
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(cfg.template)}`;

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t(`title.${kind}`)}
      description={t("description")}
      wide
      footer={
        results ? (
          <Button onClick={() => onOpenChange(false)}>{t("close")}</Button>
        ) : (
          <Button onClick={runImport} disabled={busy || valid.length === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
            {busy ? t("progress", { done: progress, total: rows.length }) : t("import", { count: valid.length })}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={`csv-${kind}`} className="text-sm font-medium">
            {t("file")}
          </label>
          <input
            id={`csv-${kind}`}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
          />
          <p className="text-xs text-muted-foreground">{t(`hint.${kind}`)}</p>
          <a href={templateHref} download={`plantilla-${kind}.csv`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            <Download className="size-4" aria-hidden /> {t("template")}
          </a>
        </div>

        {fileName && rows.length === 0 && <p className="text-sm text-danger">{t("empty")}</p>}
        {headerMissing && <p className="text-sm text-danger">{t("headers", { fields: fieldNames(cfg.required) })}</p>}

        {rows.length > 0 && !results && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">{t("summary", { valid: valid.length, total: rows.length })}</p>
            <div className="max-h-80 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label={t("previewLabel")}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-muted text-left text-xs text-muted-foreground">
                  <tr>
                    {cfg.preview.map((c) => (
                      <th key={c} className="px-3 py-2 font-medium">{t(`col.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={cn("border-t", missing(r).length && "bg-danger-soft")}>
                      {cfg.preview.map((c) => (
                        <td key={c} className="max-w-48 truncate px-3 py-1.5">{r[c] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="mt-1 text-xs text-muted-foreground">{t("more", { count: rows.length - 50 })}</p>}
          </div>
        )}

        {results && (
          <ul className="space-y-1.5" aria-live="polite">
            {results.map((r) => (
              <li key={r.row} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
                <span>
                  <span className="font-medium">{r.label}</span>
                  {r.error && (
                    <span className="text-muted-foreground">
                      {" — "}
                      {r.label === t("rowN", { n: r.row }) ? r.error : `${t("rowN", { n: r.row })}: ${r.error}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSheet>
  );
}
