import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { NAMESPACES } from "./namespaces";
import { baseLocale, intlLocale, type Locale } from "./locales";

export { LOCALES, intlLocale, baseLocale, type Locale } from "./locales";

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const)
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ locale: explicit }) => {
  // Marketing pages pass an explicit locale (/ vs /en); the app follows the cookie.
  let locale: Locale;
  if (explicit) {
    locale = baseLocale(explicit);
  } else {
    const raw = (await cookies()).get("NEXT_LOCALE")?.value;
    locale = raw === "en" ? "en" : "es";
  }

  return {
    locale: intlLocale(locale),
    messages: await loadMessages(locale),
    timeZone: "America/Puerto_Rico",
    formats: {
      number: { money: { style: "currency", currency: "USD", maximumFractionDigits: 0 } },
    },
  };
});
