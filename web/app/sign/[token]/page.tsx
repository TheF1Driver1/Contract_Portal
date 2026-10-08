import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FileSignature } from "lucide-react";
import { createAdminClient } from "@/lib/supabase-server";
import { loadMessages } from "@/i18n/request";
import { intlLocale, type Locale } from "@/i18n/locales";
import { markViewed, SignError, signerFromToken } from "@/lib/esign/service";
import { SIGN_ERROR_MESSAGES } from "@/lib/esign/http";
import { SigningCeremony } from "@/components/sign/SigningCeremony";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Firma tu contrato", robots: { index: false, follow: false } };

const mask = (v: string | null) => (!v ? null : v.includes("@") ? v.replace(/^(.).*(@.*)$/, "$1•••$2") : `•••${v.slice(-4)}`);

export default async function SignPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ p?: string; lang?: string }> }) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const admin = createAdminClient();
  const h = await headers();
  const meta = { ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null, userAgent: h.get("user-agent") };

  let session;
  try {
    session = await signerFromToken(admin, token);
  } catch (e) {
    const t = await getTranslations({ locale: "es", namespace: "sign" });
    const message = e instanceof SignError ? SIGN_ERROR_MESSAGES[e.code] ?? e.code : t("generic");
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-surface p-6 text-center">
          <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSignature className="size-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">{t("error.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <p className="mt-4 text-xs text-subtle-foreground">{t("error.help")}</p>
        </div>
      </main>
    );
  }

  await markViewed(admin, session, meta).catch(() => undefined);

  const { signer, agreement } = session;
  const locale: Locale = sp.lang === "en" || sp.lang === "es" ? sp.lang : signer.locale === "en" ? "en" : "es";
  const messages = await loadMessages(locale);
  const c = agreement.contract;
  const landlord = (agreement.profile?.company_name || agreement.profile?.full_name || "").trim();

  return (
    <NextIntlClientProvider
      locale={intlLocale(locale)}
      messages={{ sign: messages.sign, common: messages.common, builder: { signaturePad: messages.builder.signaturePad } }}
      timeZone="America/Puerto_Rico"
    >
      <SigningCeremony
        token={token}
        lang={locale}
        inPerson={sp.p === "1" || signer.in_person}
        signer={{
          name: signer.name,
          role: signer.role,
          status: signer.status,
          consented: !!signer.consented_at,
          verified: !!signer.verified_at,
          email: mask(signer.email),
          phone: mask(signer.phone),
        }}
        contract={{
          propertyLabel: agreement.propertyLabel,
          landlord,
          leaseStart: c.lease_start,
          leaseEnd: c.lease_end,
          months: c.lease_months,
          rent: c.rent_amount,
          deposit: c.security_deposit,
          sealed: !!c.sealed_pdf_path,
          status: c.status,
        }}
      />
    </NextIntlClientProvider>
  );
}
