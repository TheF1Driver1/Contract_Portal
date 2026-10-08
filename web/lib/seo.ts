import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";

/** Metadata for a page that exists in Spanish (default) and English. */
export function bilingualMetadata({
  title,
  description,
  esPath,
  enPath,
  locale,
}: {
  title: string;
  description: string;
  esPath: string;
  enPath: string;
  locale: "es" | "en";
}): Metadata {
  const path = locale === "es" ? esPath : enPath;
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { "es-PR": esPath, en: enPath, "x-default": esPath },
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "ContractOS",
      locale: locale === "es" ? "es_PR" : "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
