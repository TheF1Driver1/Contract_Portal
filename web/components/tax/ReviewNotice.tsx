import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

/** Shown wherever the Anejo N mapping is used: it has not been reviewed by a CPA. */
export function ReviewNotice({ compact }: { compact?: boolean }) {
  const t = useTranslations("tax.reviewNotice");
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-border bg-warning-soft p-4 md:p-5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        {!compact && <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>}
      </div>
    </div>
  );
}
