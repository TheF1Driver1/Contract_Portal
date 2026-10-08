// Pure locale helpers, safe to import from client and server code.
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Locale used for formatting. "es-US" formats money as $1,150 and dates as
 * "12 dic 2026", which is how Puerto Rico writes them ("es" gives "1150 US$").
 */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "es-US";
}

/** App language ("es" | "en") from a formatting locale like "es-US". */
export function baseLocale(locale: string): Locale {
  return locale.startsWith("en") ? "en" : "es";
}
