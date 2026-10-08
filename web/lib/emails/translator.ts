import { createTranslator } from "next-intl";
import es from "@/messages/es/emails.json";
import en from "@/messages/en/emails.json";

export type MessageLocale = "es" | "en";

/** Translator for outbound messages, which run outside a request locale. */
export function emailT(locale: string | null | undefined) {
  const lang: MessageLocale = locale === "en" ? "en" : "es";
  return { lang, t: createTranslator({ locale: lang === "en" ? "en-US" : "es-US", messages: { emails: lang === "en" ? en : es }, namespace: "emails" }) };
}
