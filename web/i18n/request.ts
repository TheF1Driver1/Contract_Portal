import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { NAMESPACES } from "./namespaces";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const)
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = raw === "en" ? "en" : "es";

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "America/Puerto_Rico",
    formats: {
      number: { money: { style: "currency", currency: "USD", maximumFractionDigits: 0 } },
    },
  };
});
