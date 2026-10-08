import type { LegalDoc } from "@/lib/legal-content";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export async function LegalPage({ doc, lang }: { doc: LegalDoc; lang: "es" | "en" }) {
  return (
    <div lang={lang} className="min-h-screen bg-background text-foreground">
      <SiteHeader locale={lang} />
      <main className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-sm text-subtle-foreground">{doc.updated}</p>
        <p className="mt-6 text-base leading-7 text-muted-foreground">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-base leading-7 text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter locale={lang} />
    </div>
  );
}
