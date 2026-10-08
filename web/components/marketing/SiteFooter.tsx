import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/request";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" });
  const es = locale === "es";
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="font-semibold">ContractOS</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.product")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href={es ? "/#funciones" : "/en#funciones"} className="hover:text-foreground">{t("nav.features")}</Link></li>
            <li><Link href={es ? "/pricing" : "/en/pricing"} className="hover:text-foreground">{t("nav.pricing")}</Link></li>
            <li><Link href="/login" className="hover:text-foreground">{t("nav.login")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.legal")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href={es ? "/terminos" : "/en/terms"} className="hover:text-foreground">{t("footer.terms")}</Link></li>
            <li><Link href={es ? "/privacidad" : "/en/privacy"} className="hover:text-foreground">{t("footer.privacy")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.contact")}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="mailto:hola@prcontract.online" className="hover:text-foreground">hola@prcontract.online</a></li>
            <li>
              <Link href={es ? "/en" : "/"} hrefLang={es ? "en" : "es"} className="hover:text-foreground">
                {t("nav.language")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t py-6 text-center text-xs text-subtle-foreground">
        {t("footer.rights", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}
