import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when the API answers 402 (plan without market access). */
export function UpgradeCard({ title, message, cta }: { title: string; message: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border bg-surface p-4 md:flex-row md:items-center md:p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        <Lock className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild>
        <Link href="/settings/billing">{cta}</Link>
      </Button>
    </div>
  );
}
