import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PAGES: { es: string; en: string; priority: number }[] = [
  { es: "/", en: "/en", priority: 1 },
  { es: "/pricing", en: "/en/pricing", priority: 0.8 },
  { es: "/terminos", en: "/en/terms", priority: 0.3 },
  { es: "/privacidad", en: "/en/privacy", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ es, en, priority }) => {
    const languages = { "es-PR": `${SITE_URL}${es}`, en: `${SITE_URL}${en}` };
    return [
      { url: `${SITE_URL}${es}`, priority, alternates: { languages } },
      { url: `${SITE_URL}${en}`, priority: priority * 0.9, alternates: { languages } },
    ];
  });
}
