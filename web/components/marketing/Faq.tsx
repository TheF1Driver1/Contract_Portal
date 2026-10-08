/** Accessible FAQ using native <details>, no JS needed. */
export function Faq({ title, items, id }: { title: string; items: { q: string; a: string }[]; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? "faq"}-title`} className="mx-auto max-w-3xl">
      <h2 id={`${id ?? "faq"}-title`} className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-8 divide-y rounded-xl border bg-surface">
        {items.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {item.q}
              <span aria-hidden className="text-subtle-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** FAQPage structured data for search engines. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}
