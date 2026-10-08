import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/settings/SectionHeader";

type Category = "date" | "tenant" | "property" | "amenities" | "occupants" | "lease" | "payment" | "other";

// Example values are sample data as they appear inside a Spanish lease.
const VARIABLES: { name: string; category: Category; required: boolean; example: string }[] = [
  { name: "dia", category: "date", required: true, example: "15" },
  { name: "mes", category: "date", required: true, example: "enero" },
  { name: "anio", category: "date", required: true, example: "2025" },

  { name: "nombre_arrendatario", category: "tenant", required: true, example: "Juan García" },
  { name: "seguro_social", category: "tenant", required: false, example: "xxx-xx-1234" },
  { name: "numero_licencia", category: "tenant", required: false, example: "B1234567" },
  { name: "residencia_actual", category: "tenant", required: false, example: "123 Calle Sol, San Juan" },

  { name: "cantidad_cuartos", category: "property", required: true, example: "2" },
  { name: "cantidad_abanicos_techo", category: "property", required: false, example: "3" },
  { name: "cantidad_estufas", category: "property", required: false, example: "1" },
  { name: "cantidad_stools", category: "property", required: false, example: "2" },

  { name: "tiene_puertas_de_espejo", category: "amenities", required: false, example: "✔" },
  { name: "tiene_bano_remodelado", category: "amenities", required: false, example: "__________" },
  { name: "tiene_microondas", category: "amenities", required: false, example: "✔" },
  { name: "tiene_nevera", category: "amenities", required: false, example: "✔" },
  { name: "tiene_aire_acondicionado", category: "amenities", required: false, example: "__________" },
  { name: "tiene_cortinas_miniblinds", category: "amenities", required: false, example: "✔" },
  { name: "tiene_sofa", category: "amenities", required: false, example: "__________" },
  { name: "tiene_futton", category: "amenities", required: false, example: "__________" },
  { name: "tiene_cuadros", category: "amenities", required: false, example: "__________" },
  { name: "incluye_estacionamiento", category: "amenities", required: false, example: "✔" },

  { name: "cantidad_personas", category: "occupants", required: true, example: "2" },

  { name: "cantidad_de_anios_contrato", category: "lease", required: true, example: "1" },
  { name: "cantidad_de_meses_contrato", category: "lease", required: true, example: "12" },
  { name: "dia_comienzo_contrato", category: "lease", required: true, example: "1" },
  { name: "mes_comienzo_contrato", category: "lease", required: true, example: "enero" },
  { name: "anio_comienzo_contrato", category: "lease", required: true, example: "2025" },
  { name: "dia_que_culmina_contrato", category: "lease", required: true, example: "31" },
  { name: "mes_que_culmina_contrato", category: "lease", required: true, example: "diciembre" },
  { name: "anio_que_culmina_contrato", category: "lease", required: true, example: "2025" },

  { name: "canon_arrendamiento_numero", category: "payment", required: true, example: "1200" },
  { name: "canon_arrendamiento_verbal", category: "payment", required: false, example: "mil doscientos" },
  { name: "cantidad_pago_firma", category: "payment", required: true, example: "1200" },
  { name: "dia_pago_tarde", category: "payment", required: true, example: "5" },

  { name: "cantidad_llaves", category: "other", required: false, example: "2" },
  { name: "firma_arrendador", category: "other", required: false, example: "" },
  { name: "firma_arrendatario", category: "other", required: false, example: "" },
];

const CATEGORIES: Category[] = ["date", "tenant", "property", "amenities", "occupants", "lease", "payment", "other"];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
  );
}

export default async function VariableGuidePage() {
  const t = await getTranslations("settings.guide");

  return (
    <div className="max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-10 text-muted-foreground sm:h-8">
        <Link href="/settings/templates">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>

      <SectionHeader
        title={t("title")}
        description={t.rich("description", { code: () => <Code>{"{{ variable_name }}"}</Code> })}
        actions={
          <Button asChild variant="outline" className="h-10 sm:h-9">
            <a href="/templates/contract_template.docx" download>
              <Download aria-hidden />
              {t("starter")}
            </a>
          </Button>
        }
      />

      <section aria-labelledby="how-to" className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h3 id="how-to" className="text-base font-semibold text-foreground">{t("howTitle")}</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-subtle-foreground">
          <li>{t("step1")}</li>
          <li>{t.rich("step2", { code: () => <Code>{"{{nombre_arrendatario}}"}</Code> })}</li>
          <li>{t.rich("step3", { strong: (c) => <strong className="font-semibold text-foreground">{c}</strong> })}</li>
          <li>{t("step4")}</li>
          <li>{t.rich("step5", { code: () => <Code>{"{{variable}}"}</Code> })}</li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.rich("amenityNote", {
            check: () => <Code>✔</Code>,
            blank: () => <Code>__________</Code>,
          })}
        </p>
      </section>

      {CATEGORIES.map((cat) => {
        const vars = VARIABLES.filter((v) => v.category === cat);
        const headingId = `cat-${cat}`;
        return (
          <section key={cat} aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-border bg-surface">
            <h3 id={headingId} className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground md:px-5">
              {t(`categories.${cat}`)}
            </h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted hover:bg-surface-muted">
                  <TableHead className="w-[38%] px-4 text-xs md:px-5">{t("colVariable")}</TableHead>
                  <TableHead className="text-xs">{t("colMapsTo")}</TableHead>
                  <TableHead className="hidden text-xs sm:table-cell">{t("colExample")}</TableHead>
                  <TableHead className="w-24 text-xs">{t("colRequired")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vars.map((v) => (
                  <TableRow key={v.name}>
                    <TableCell className="px-4 align-top md:px-5">
                      <Code>{`{{${v.name}}}`}</Code>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-muted-foreground">
                      {t(`vars.${v.name}`)}
                    </TableCell>
                    <TableCell className="hidden align-top font-mono text-xs text-muted-foreground sm:table-cell">
                      {v.example || t("signatureExample")}
                    </TableCell>
                    <TableCell className="align-top">
                      {v.required ? (
                        <Badge className="bg-primary-soft text-primary-soft-foreground">{t("required")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("optional")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
