import { AlertCircle } from "lucide-react";

/** Inline form error, announced to screen readers. */
export function FormError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
