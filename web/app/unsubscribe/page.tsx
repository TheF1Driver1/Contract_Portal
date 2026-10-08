import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase-server";
import { verifyUnsubscribe } from "@/lib/lifecycle/unsubscribe";
import { optOutLifecycle } from "@/lib/lifecycle/optout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ContractOS", robots: { index: false, follow: false } };

// The link only shows a confirmation; the change needs a click, so link
// scanners that prefetch email URLs can't unsubscribe anyone.
export default async function UnsubscribePage(props: { searchParams: Promise<{ u?: string; s?: string; done?: string }> }) {
  const { u, s, done } = await props.searchParams;
  const valid = verifyUnsubscribe(u, s);
  let locale: "es" | "en" = "es";
  if (valid) {
    const { data } = await createAdminClient().from("profiles").select("locale").eq("id", u!).maybeSingle();
    if (data?.locale === "en") locale = "en";
  }
  const t = await getTranslations({ locale, namespace: "emails.unsubscribePage" });

  async function confirm() {
    "use server";
    if (await optOutLifecycle(u, s)) redirect(`/unsubscribe?u=${u}&s=${s}&done=1`);
  }

  return (
    <main lang={locale} className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-surface p-6 text-center">
        <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <MailX className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{!valid ? t("invalid") : done ? t("done") : t("confirm")}</p>
        {valid && !done && (
          <form action={confirm} className="mt-4">
            <Button type="submit">{t("button")}</Button>
          </form>
        )}
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
