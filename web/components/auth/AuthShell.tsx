import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

/** ContractOS logo mark: FileSignature in a primary square plus the wordmark. */
export function BrandMark({ href = "/", className }: { href?: string; className?: string }) {
  const t = useTranslations("auth");
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 rounded-md text-foreground", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <FileSignature className="size-4" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight">{t("brand")}</span>
    </Link>
  );
}

/**
 * Centered card layout shared by the auth and invite pages:
 * logo, optional media (status icon or context), title, description, form, footer links.
 */
export function AuthShell({
  title,
  description,
  media,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-10">
      <div className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}>
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
          {media && <div className="mb-4">{media}</div>}
          <div className="mb-5 space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}

/** Round status icon for result screens (success, error, neutral). */
export function AuthStatusIcon({
  tone,
  children,
}: {
  tone: "success" | "danger" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-11 items-center justify-center rounded-full [&_svg]:size-5",
        tone === "success" && "bg-success-soft text-success",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "neutral" && "bg-surface-muted text-muted-foreground"
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
