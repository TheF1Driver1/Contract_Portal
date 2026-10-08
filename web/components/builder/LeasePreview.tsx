"use client";

import { createFormatter, createTranslator } from "next-intl";
import type { ContractFormValues, Property, Tenant } from "@/lib/types";
import esBuilder from "@/messages/es/builder.json";
import { AMENITY_FLAGS, COUNT_FIELDS, dateOnly, type LocalSection } from "./form-utils";

/**
 * Readable rendering of the lease from the current form values.
 * The lease text is always Spanish, like the generated document; it is an
 * illustrative preview, the final document comes from the selected template.
 */
const tl = createTranslator({ locale: "es", messages: esBuilder, namespace: "lease" });
const fmt = createFormatter({ locale: "es", timeZone: "America/Puerto_Rico" });
const list = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

export interface LeasePreviewProps {
  values: Partial<ContractFormValues>;
  property?: Property | null;
  tenant?: Tenant | null;
  coTenants: Tenant[];
  sections: LocalSection[];
}

type Clause = { title: string; body: string };

const money = (n: number) =>
  fmt.number(n, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = (d: string) => fmt.dateTime(dateOnly(d), { dateStyle: "long" });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function buildLeaseClauses({ values: v, property, tenant, coTenants, sections }: LeasePreviewProps) {
  const blank = tl("blank");
  const clauses: Clause[] = [];

  const address = property
    ? [property.address, property.city, [property.state, property.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : blank;
  clauses.push({
    title: tl("property.title"),
    body:
      tl("property.body", { name: property?.name ?? blank, address }) +
      (v.unit_number ? tl("property.unit", { unit: v.unit_number }) : "") +
      ".",
  });

  const months = num(v.lease_months);
  clauses.push({
    title: tl("term.title"),
    body: tl("term.body", {
      months: months ?? 0,
      hasMonths: months ? "yes" : "no",
      start: v.lease_start ? longDate(v.lease_start) : blank,
      end: v.lease_end ? longDate(v.lease_end) : blank,
    }),
  });

  const rent = num(v.rent_amount);
  clauses.push({
    title: tl("rent.title"),
    body:
      tl("rent.body", {
        rent: rent ? money(rent) : blank,
        day: num(v.payment_due_day) ?? blank,
      }) + (v.rent_amount_verbal ? " " + tl("rent.verbal", { verbal: v.rent_amount_verbal }) : ""),
  });

  const deposit = num(v.security_deposit);
  clauses.push({
    title: tl("deposit.title"),
    body: deposit ? tl("deposit.body", { deposit: money(deposit) }) : tl("deposit.none"),
  });

  const fixed = num(v.late_fee_fixed_amount);
  const daily = num(v.late_fee_daily_amount);
  const lateDay = Math.min(31, (num(v.payment_due_day) ?? 1) + (num(v.late_fee_grace_period_days) ?? 0));
  const type = v.late_fee_type ?? "fixed";
  const noFee = (type === "fixed" && !fixed) || (type === "daily" && !daily) || (type === "both" && !fixed && !daily);
  clauses.push({
    title: tl("lateFee.title"),
    body: noFee
      ? tl("lateFee.none")
      : tl(`lateFee.${type}`, {
          day: lateDay,
          fixed: fixed ? money(fixed) : blank,
          daily: daily ? money(daily) : blank,
        }),
  });

  const names = (v.occupant_names ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  clauses.push({
    title: tl("occupants.title"),
    body:
      tl("occupants.body", { count: num(v.occupant_count) ?? 1 }) +
      (names.length ? tl("occupants.names", { names: list.format(names) }) : "") +
      ".",
  });

  clauses.push({ title: tl("keys.title"), body: tl("keys.body", { count: num(v.key_count) ?? 0 }) });

  if (v.parking_available) {
    clauses.push({
      title: tl("parking.title"),
      body:
        tl("parking.body", { count: num(v.parking_count) ?? 1 }) +
        (v.parking_spot ? tl("parking.spot", { spot: v.parking_spot }) : "") +
        ".",
    });
  }

  const items = [
    ...COUNT_FIELDS.map(({ name }) => ({ name, n: num(v[name]) ?? 0 }))
      .filter(({ n }) => n > 0)
      .map(({ name, n }) => tl(`items.${name}`, { count: n })),
    ...AMENITY_FLAGS.filter((name) => v[name]).map((name) => tl(`items.${name}`)),
    ...(v.custom_amenities ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  if (items.length) {
    clauses.push({ title: tl("furnishings.title"), body: tl("furnishings.body", { items: list.format(items) }) });
  }

  for (const s of sections) {
    if (s.title.trim()) clauses.push({ title: s.title, body: s.body });
  }

  const j = v.jurisdiction ?? "pr";
  clauses.push({ title: tl("law.title"), body: tl(`law.${j}`) });

  const tenantNames = [tenant?.full_name, ...coTenants.map((c) => c.full_name)].filter(Boolean) as string[];

  return { clauses, tenantNames, blank };
}

export function LeasePreview(props: LeasePreviewProps) {
  const { clauses, tenantNames, blank } = buildLeaseClauses(props);
  const type = props.values.contract_type ?? "lease";

  return (
    <article lang="es" className="space-y-4 text-sm leading-relaxed text-foreground">
      <header className="space-y-2 text-center">
        <h3 className="text-base font-semibold tracking-wide">{tl(`title.${type}`)}</h3>
      </header>
      <p>
        {tl("parties", {
          tenants: tenantNames.length ? list.format(tenantNames) : blank,
        })}
      </p>
      <ol className="space-y-3">
        {clauses.map((c, i) => (
          <li key={`${i}-${c.title}`}>
            <p className="font-semibold">
              {tl("clauseHeading", { n: i + 1, title: c.title.toLocaleUpperCase("es") })}
            </p>
            {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
          </li>
        ))}
      </ol>
      <div className="grid gap-6 pt-4 sm:grid-cols-2">
        <SignatureLine label={tl("signatures.landlord")} />
        {(tenantNames.length ? tenantNames : [blank]).map((name, i) => (
          <SignatureLine key={i} label={tl("signatures.tenant", { name })} />
        ))}
      </div>
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">{tl("disclaimer")}</p>
    </article>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <div className="h-8 border-b border-border-strong" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
