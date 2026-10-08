import { emailLayout } from "@/lib/emails/layout";
import { emailT } from "@/lib/emails/translator";
import type { LifecycleStep } from "@/lib/lifecycle/steps";

const CTA_PATH: Record<LifecycleStep, string> = {
  welcome: "/dashboard",
  first_property: "/properties?new=1",
  first_contract: "/contracts/new",
  esign: "/contracts",
};

export function buildLifecycleEmail(opts: {
  step: LifecycleStep;
  name: string | null;
  locale: string | null | undefined;
  appUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const { lang, t } = emailT(opts.locale);
  const k = `lifecycle.${opts.step}` as const;
  const paragraphs =
    opts.step === "welcome"
      ? [t("lifecycle.welcome.body1", { name: opts.name?.split(" ")[0] || (lang === "en" ? "there" : "") }).replace(" :", ":"), t("lifecycle.welcome.body2"), t("lifecycle.welcome.body3")]
      : [t(`${k}.body1`), t(`${k}.body2`)];
  return {
    subject: t(`${k}.subject`),
    html: emailLayout({
      lang,
      heading: t(`${k}.heading`),
      paragraphs,
      cta: { label: t(`${k}.cta`), url: `${opts.appUrl}${CTA_PATH[opts.step]}` },
      footer: t("lifecycle.footer"),
      unsubscribe: { label: t("lifecycle.unsubscribe"), url: opts.unsubscribeUrl },
    }),
  };
}
