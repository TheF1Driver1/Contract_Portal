import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/request";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing.nav" });
  const home = locale === "es" ? "/" : "/en";
  const pricing = locale === "es" ? "/pricing" : "/en/pricing";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSignature className="size-4" aria-hidden />
          </span>
          ContractOS
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label={locale === "es" ? "Principal" : "Main"}>
          <Link href={`${home}#funciones`} className="hover:text-foreground">{t("features")}</Link>
          <Link href={pricing} className="hover:text-foreground">{t("pricing")}</Link>
          <Link href={`${home}#preguntas`} className="hover:text-foreground">{t("faq")}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={locale === "es" ? "/en" : "/"}
            hrefLang={locale === "es" ? "en" : "es"}
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            {t("language")}
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{t("signup")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
