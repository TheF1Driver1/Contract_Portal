import Link from "next/link";
import type { LegalDoc } from "@/lib/legal-content";

export function LegalPage({ doc, lang }: { doc: LegalDoc; lang: "es" | "en" }) {
  return (
    <main lang={lang} className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-10 flex items-center justify-between text-sm">
          <Link href={lang === "es" ? "/" : "/en"} className="font-semibold text-teal-800 hover:underline">
            ContractOS
          </Link>
          <Link href={doc.altHref} className="text-slate-600 hover:underline" hrefLang={lang === "es" ? "en" : "es"}>
            {doc.altLabel}
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{doc.updated}</p>
        <p className="mt-6 text-base leading-7 text-slate-700">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-base leading-7 text-slate-700">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
