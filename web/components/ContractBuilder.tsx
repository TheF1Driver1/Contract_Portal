"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Eye, Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  Contract,
  ContractCustomSection,
  ContractFormValues,
  ContractTemplate,
  Property,
  Tenant,
  UserSectionTemplate,
} from "@/lib/types";
import { saveContract } from "@/lib/actions/contracts";
import { planLimitMessage } from "@/lib/plan-errors";
import { cn } from "@/lib/utils";
import { BuilderContext, useBuilder, type BuilderData } from "@/components/builder/context";
import {
  DEFAULT_VALUES,
  STEP_FIELDS,
  STEP_KEYS,
  addMonths,
  contractPayload,
  stepForField,
  valuesFromContract,
  type LocalSection,
} from "@/components/builder/form-utils";
import { Stepper } from "@/components/builder/Stepper";
import { StepParties } from "@/components/builder/StepParties";
import { StepTerms } from "@/components/builder/StepTerms";
import { StepClauses } from "@/components/builder/StepClauses";
import { StepReview } from "@/components/builder/StepReview";
import { LeasePreview } from "@/components/builder/LeasePreview";

export interface ContractBuilderProps {
  properties: Property[];
  tenants: Tenant[];
  templates: ContractTemplate[];
  userId: string;
  landlordEmail: string;
  initialData?: Contract | null;
  /** AI clause translation (Plan 39); the page passes aiEnabled(). */
  aiTranslate?: boolean;
}

const AUTOSAVE_MS = 60_000;
const PREVIEW_DEBOUNCE_MS = 300;
const LAST_STEP = STEP_KEYS.length - 1;

export function ContractBuilder({
  properties,
  tenants,
  templates,
  landlordEmail,
  initialData,
  aiTranslate = false,
}: ContractBuilderProps) {
  const t = useTranslations("builder");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(initialData?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState<"pdf" | "docx" | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [landlordEmailInput, setLandlordEmailInput] = useState(landlordEmail);
  const [coTenantIds, setCoTenantIdsState] = useState<string[]>([]);
  const [coTenantSignatures, setCoTenantSignaturesState] = useState<string[]>([]);
  const [sections, setSectionsState] = useState<LocalSection[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserSectionTemplate[]>([]);
  const topRef = useRef<HTMLDivElement>(null);

  const form = useForm<ContractFormValues>({ defaultValues: DEFAULT_VALUES });
  const { control, setValue, reset, trigger, handleSubmit, getValues, subscribe } = form;

  // ── Unsaved-change tracking for autosave ──────────────────────────────
  const dirtyRef = useRef(false);
  const savedIdRef = useRef(savedId);
  useEffect(() => {
    savedIdRef.current = savedId;
  }, [savedId]);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef = useRef<() => void>(() => {});

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true;
    if (!savedIdRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => autosaveRef.current(), AUTOSAVE_MS);
  }, []);

  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  }, []);

  useEffect(() => {
    // Only user edits (type "change") count; programmatic setValue/reset do not.
    return subscribe({
      formState: { values: true },
      callback: ({ type }) => {
        if (type === "change") scheduleAutosave();
      },
    });
  }, [subscribe, scheduleAutosave]);

  const setCoTenantIds = useCallback((next: string[]) => {
    setCoTenantIdsState(next);
    scheduleAutosave();
  }, [scheduleAutosave]);
  const setCoTenantSignatures = useCallback((next: string[]) => {
    setCoTenantSignaturesState(next);
    scheduleAutosave();
  }, [scheduleAutosave]);
  const setSections = useCallback((next: LocalSection[]) => {
    setSectionsState(next);
    scheduleAutosave();
  }, [scheduleAutosave]);

  // ── Derived values ───────────────────────────────────────────────────
  const [leaseStart, leaseMonths, propertyId] = useWatch({
    control,
    name: ["lease_start", "lease_months", "property_id"],
  });

  useEffect(() => {
    if (!leaseStart || !leaseMonths) return;
    const end = addMonths(leaseStart, Number(leaseMonths));
    if (end) setValue("lease_end", end, { shouldValidate: true });
  }, [leaseStart, leaseMonths, setValue]);

  useEffect(() => {
    if (!propertyId) return;
    const prop = properties.find((p) => p.id === propertyId);
    if (!prop) return;
    setValue("bathroom_count", prop.bathroom_count ?? 1);
    setValue("parking_available", prop.parking_available ?? false);
    setValue("parking_count", prop.parking_count ?? 1);
  }, [propertyId, properties, setValue]);

  // Pre-populate when editing a draft.
  useEffect(() => {
    if (!initialData) return;
    reset(valuesFromContract(initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  // Clause library.
  useEffect(() => {
    fetch("/api/user-sections")
      .then((r) => r.json())
      .then((data) => setUserTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Existing clauses of the draft.
  useEffect(() => {
    if (!initialData?.id) return;
    fetch(`/api/contracts/${initialData.id}/sections`)
      .then((r) => r.json())
      .then((data: ContractCustomSection[]) =>
        setSectionsState(Array.isArray(data) ? data.map((s) => ({ title: s.title, body: s.body })) : [])
      )
      .catch(() => {});
  }, [initialData?.id]);

  // ── Save / generate / send ───────────────────────────────────────────
  const showError = useCallback(
    (message: string) => {
      const isPlanLimit = !!planLimitMessage(message) || /plan/i.test(message);
      toast.error(message, isPlanLimit
        ? { action: { label: t("toast.seePlans"), onClick: () => router.push("/settings/billing") } }
        : undefined);
    },
    [router, t]
  );

  /** Saves through the server action; returns the contract id or null (error already shown). */
  const save = useCallback(
    async (data: ContractFormValues, opts: { silent?: boolean } = {}): Promise<string | null> => {
      setSaving(true);
      try {
        const result = await saveContract({
          id: savedIdRef.current,
          contract: contractPayload(data),
          coTenants: coTenantIds
            .map((tid, i) => ({ tenant_id: tid, signature: coTenantSignatures[i] || null }))
            .filter((c) => !!c.tenant_id),
          sections,
        });
        if (!result.ok) {
          if (opts.silent) setAutosaveFailed(true);
          showError(result.error);
          return null;
        }
        dirtyRef.current = false;
        setAutosaveFailed(false);
        setSavedId(result.id);
        savedIdRef.current = result.id;
        setLastSavedAt(new Date());
        return result.id;
      } catch {
        if (opts.silent) setAutosaveFailed(true);
        showError(t("toast.saveFailed"));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [coTenantIds, coTenantSignatures, sections, showError, t]
  );

  useEffect(() => {
    autosaveRef.current = () => {
      if (!savedIdRef.current || !dirtyRef.current || saving || sending) return;
      void save(getValues(), { silent: true });
    };
  });

  const onInvalid = useCallback(
    (errors: FieldErrors<ContractFormValues>) => {
      const first = Object.keys(errors)[0];
      if (first) setStep(stepForField(first));
      toast.error(t("toast.fixErrors"));
    },
    [t]
  );

  const saveDraft = () =>
    handleSubmit(async (data) => {
      const id = await save(data);
      if (id) toast.success(t("toast.saved"));
    }, onInvalid)();

  const download = (format: "pdf" | "docx") =>
    handleSubmit(async (data) => {
      const contractId = await save(data);
      if (!contractId) return;
      setGenerating(format);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId, format }),
        });
        if (!res.ok) throw new Error(await res.text());
        const contentType = res.headers.get("content-type") ?? "";
        const ext = contentType.includes("pdf") ? "pdf" : "docx";
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contract_${contractId}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error(t("toast.downloadFailed"));
      } finally {
        setGenerating(null);
      }
    }, onInvalid)();

  async function generateAndStore(contractId: string): Promise<string | null> {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, format: "pdf", store: true }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      return result.pdf_url ?? null;
    } catch {
      return null;
    }
  }

  const send = (e?: React.BaseSyntheticEvent) =>
    handleSubmit(async (data) => {
    const contractId = await save(data);
    if (!contractId) return;
    setSending(true);
    try {
      setGenerating("pdf");
      try {
        await generateAndStore(contractId);
      } finally {
        setGenerating(null);
      }
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          ...(landlordEmailInput ? { landlordEmail: landlordEmailInput } : {}),
          ...(data.send_sms && data.recipient_phone ? { phone: data.recipient_phone } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.results?.email && result.results.email !== "sent") {
        toast.warning(t("toast.emailIssue", { issue: String(result.results.email) }));
      } else {
        toast.success(t("toast.sent"));
      }
      router.push(`/contracts/${contractId}`);
    } catch {
      toast.error(t("toast.sendFailed"));
    } finally {
      setSending(false);
    }
  }, onInvalid)(e);

  // ── Navigation ───────────────────────────────────────────────────────
  const goToStep = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(LAST_STEP, next)));
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  /** Moving forward validates every step in between; going back is free. */
  const selectStep = useCallback(
    async (target: number) => {
      if (target <= step) return goToStep(target);
      for (let s = step; s < target; s++) {
        const fields = STEP_FIELDS[s];
        if (fields.length && !(await trigger(fields))) return goToStep(s);
      }
      goToStep(target);
    },
    [step, trigger, goToStep]
  );

  const builderData: BuilderData = useMemo(
    () => ({
      properties,
      tenants,
      templates,
      userTemplates,
      coTenantIds,
      setCoTenantIds,
      coTenantSignatures,
      setCoTenantSignatures,
      sections,
      setSections,
      landlordEmail: landlordEmailInput,
      setLandlordEmail: setLandlordEmailInput,
      goToStep,
      aiTranslate,
    }),
    [
      properties,
      tenants,
      templates,
      userTemplates,
      coTenantIds,
      setCoTenantIds,
      coTenantSignatures,
      setCoTenantSignatures,
      sections,
      setSections,
      landlordEmailInput,
      goToStep,
      aiTranslate,
    ]
  );

  const busy = saving || sending || !!generating;

  return (
    <FormProvider {...form}>
      <BuilderContext.Provider value={builderData}>
        <div ref={topRef} className="scroll-mt-4 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Stepper step={step} onSelect={selectStep} />
            </div>
            <MobilePreviewButton />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <form onSubmit={send} noValidate className="min-w-0">
              <h2 className="mb-4 text-lg font-semibold text-foreground">{t(`steps.${STEP_KEYS[step]}`)}</h2>

              {step === 0 && <StepParties />}
              {step === 1 && <StepTerms />}
              {step === 2 && <StepClauses />}
              {step === 3 && (
                <StepReview
                  saving={saving}
                  generating={generating}
                  sending={sending}
                  onSaveDraft={saveDraft}
                  onDownload={download}
                />
              )}

              {/* Sticky footer: sits above the phone tab bar, at the bottom on desktop. */}
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 flex items-center gap-2 border-t border-border bg-surface px-4 py-3 md:bottom-0 md:mx-0 md:rounded-xl md:border">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={step === 0}
                  onClick={() => goToStep(step - 1)}
                >
                  <ArrowLeft />
                  <span className="max-sm:sr-only">{t("actions.back")}</span>
                </Button>

                <SaveIndicator
                  saving={saving}
                  failed={autosaveFailed}
                  savedId={savedId}
                  lastSavedAt={lastSavedAt}
                />

                <Button
                  type="button"
                  variant="ghost"
                  className="h-10"
                  disabled={busy}
                  onClick={saveDraft}
                  aria-label={t("actions.saveDraft")}
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  <span className="max-md:sr-only">{t("actions.saveDraft")}</span>
                </Button>

                {step < LAST_STEP ? (
                  <Button type="button" className="h-10" onClick={() => selectStep(step + 1)}>
                    {t("actions.next")}
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button type="submit" className="h-10" disabled={busy}>
                    {sending ? <Loader2 className="animate-spin" /> : <Send />}
                    <span className="max-sm:sr-only">{t("actions.send")}</span>
                  </Button>
                )}
              </div>
            </form>

            <aside aria-labelledby="preview-title" className="hidden lg:block">
              <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-5 py-3">
                  <h2 id="preview-title" className="text-base font-semibold text-foreground">
                    {t("preview.title")}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t("preview.description")}</p>
                </div>
                <div className="overflow-y-auto p-5" tabIndex={0} role="region" aria-label={t("preview.title")}>
                  <PreviewContent />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </BuilderContext.Provider>
    </FormProvider>
  );
}

export default ContractBuilder;

/** Debounced lease preview fed by the shared form + builder state. */
function PreviewContent() {
  const values = useWatch<ContractFormValues>() as ContractFormValues;
  const { properties, tenants, coTenantIds, sections } = useBuilder();
  const [debounced, setDebounced] = useState(values);

  const key = JSON.stringify(values);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(JSON.parse(key)), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [key]);

  const property = properties.find((p) => p.id === debounced.property_id) ?? null;
  const tenant = tenants.find((tn) => tn.id === debounced.tenant_id) ?? null;
  const coTenants = coTenantIds
    .filter(Boolean)
    .map((id) => tenants.find((tn) => tn.id === id))
    .filter((x): x is Tenant => !!x);

  return (
    <LeasePreview
      values={debounced}
      property={property}
      tenant={tenant}
      coTenants={coTenants}
      sections={sections}
    />
  );
}

function MobilePreviewButton() {
  const t = useTranslations("builder");
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="h-10 shrink-0 lg:hidden">
          <Eye />
          {t("preview.open")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("preview.title")}</SheetTitle>
          <SheetDescription>{t("preview.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4" tabIndex={0} role="region" aria-label={t("preview.title")}>
          <PreviewContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SaveIndicator({
  saving,
  failed,
  savedId,
  lastSavedAt,
}: {
  saving: boolean;
  failed: boolean;
  savedId: string | null;
  lastSavedAt: Date | null;
}) {
  const t = useTranslations("builder");
  const f = useFormatter();
  const now = useNow({ updateInterval: 15_000 });

  let text: string;
  if (saving) text = t("autosave.saving");
  else if (failed) text = t("autosave.failed");
  else if (lastSavedAt) {
    const ago = now.getTime() - lastSavedAt.getTime() < 10_000 ? t("autosave.justNow") : f.relativeTime(lastSavedAt, now);
    text = t("autosave.savedAgo", { time: ago });
  } else if (savedId) text = t("autosave.draft");
  else text = t("autosave.notSaved");

  return (
    <p
      aria-live="polite"
      className={cn("min-w-0 flex-1 truncate text-xs", failed ? "text-danger" : "text-muted-foreground")}
    >
      {saving && <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden="true" />}
      {text}
    </p>
  );
}

