import Link from "next/link";
import { Check } from "lucide-react";

const tiers = [
  {
    id: "free",
    name: "Gratis",
    nameEn: "Free",
    price: "$0",
    period: "/mes",
    description: "Para comenzar a gestionar tu propiedad.",
    descriptionEn: "Get started managing your property.",
    features: [
      "1 propiedad",
      "3 contratos/mes",
      "Plantilla de contrato básica",
      "Entrega por correo electrónico",
      "Portal de firma para arrendatarios",
    ],
    featuresEn: [
      "1 property",
      "3 contracts/month",
      "Basic contract template",
      "Email delivery",
      "Tenant signing portal",
    ],
    cta: "Comenzar gratis",
    ctaEn: "Start free",
    href: "/signup",
    highlighted: false,
  },
  {
    id: "propietario",
    name: "Propietario",
    nameEn: "Landlord",
    price: "$29",
    period: "/mes",
    description: "Para el propietario puertorriqueño con hasta 5 propiedades.",
    descriptionEn: "For Puerto Rican landlords with up to 5 properties.",
    features: [
      "Hasta 5 propiedades",
      "Contratos ilimitados",
      "Plantillas conformes a Ley 14-2022",
      "Envío por SMS y correo electrónico",
      "Seguimiento de gastos + exportación CSV",
      "Análisis de mercado",
      "Lista de seguimiento de propiedades",
      "Cláusulas personalizadas",
    ],
    featuresEn: [
      "Up to 5 properties",
      "Unlimited contracts",
      "Ley 14-2022 compliant templates",
      "SMS + email delivery",
      "Expense tracking + CSV export",
      "Market analytics",
      "Property watchlist",
      "Custom clauses",
    ],
    cta: "Comenzar",
    ctaEn: "Get started",
    href: "/api/billing/checkout?plan=propietario",
    highlighted: true,
    badge: "Más popular",
    badgeEn: "Most popular",
  },
  {
    id: "inversionista",
    name: "Inversionista",
    nameEn: "Investor",
    price: "$99",
    period: "/mes",
    description: "Para inversionistas Act 60 con portafolios múltiples.",
    descriptionEn: "For Act 60 investors with multiple properties.",
    features: [
      "Propiedades ilimitadas",
      "Todo lo de Propietario",
      "Reporte Schedule E (IRS)",
      "Panel de portafolio",
      "Delegación a administradores (hasta 3)",
      "Soporte prioritario (48 horas)",
      "Documentos de cumplimiento Act 60",
    ],
    featuresEn: [
      "Unlimited properties",
      "Everything in Propietario",
      "IRS Schedule E report",
      "Portfolio dashboard",
      "Property manager delegation (up to 3)",
      "Priority support (48h SLA)",
      "Act 60 compliance documents",
    ],
    cta: "Comenzar",
    ctaEn: "Get started",
    href: "/api/billing/checkout?plan=inversionista",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div
      className="min-h-screen py-20 px-4"
      style={{ background: "#000000" }}
    >
      {/* Header */}
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0e4d34, #10b981)" }}
          >
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-white font-bold text-xl">ContractOS</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-bold mb-4"
          style={{ color: "#ffffff" }}
        >
          Precios simples, sin sorpresas
        </h1>
        <p className="text-lg" style={{ color: "rgba(200,210,230,0.60)" }}>
          Diseñado para propietarios en Puerto Rico
          <br />
          <span style={{ color: "rgba(200,210,230,0.40)", fontSize: "0.875rem" }}>
            Simple pricing for Puerto Rico landlords
          </span>
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="relative flex flex-col rounded-2xl p-6"
            style={{
              background: tier.highlighted
                ? "rgba(16, 185, 129,0.10)"
                : "rgba(255,255,255,0.04)",
              border: tier.highlighted
                ? "1px solid rgba(16, 185, 129,0.40)"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow: tier.highlighted
                ? "0 0 40px rgba(16, 185, 129,0.15)"
                : "none",
            }}
          >
            {tier.badge && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "#10b981", color: "#fff" }}
              >
                {tier.badge}
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-0.5">{tier.name}</h2>
              <p className="text-xs" style={{ color: "rgba(200,210,230,0.40)" }}>
                {tier.nameEn}
              </p>
              <div className="flex items-end gap-1 mt-4">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                <span className="text-sm mb-1" style={{ color: "rgba(200,210,230,0.50)" }}>
                  {tier.period}
                </span>
              </div>
              <p className="text-sm mt-2" style={{ color: "rgba(200,210,230,0.60)" }}>
                {tier.description}
              </p>
            </div>

            <ul className="flex-1 space-y-2.5 mb-8">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check
                    size={15}
                    className="shrink-0 mt-0.5"
                    style={{ color: tier.highlighted ? "#10b981" : "rgba(0,200,100,0.80)" }}
                  />
                  <span className="text-sm" style={{ color: "rgba(200,210,230,0.80)" }}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.href}
              className="block w-full py-2.5 rounded-xl text-center text-sm font-semibold transition-all"
              style={{
                background: tier.highlighted ? "#10b981" : "rgba(255,255,255,0.08)",
                color: tier.highlighted ? "#fff" : "rgba(200,210,230,0.90)",
                border: tier.highlighted ? "none" : "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Enterprise CTA */}
      <div className="max-w-5xl mx-auto mt-8">
        <div
          className="rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <h3 className="text-white font-semibold">Enterprise</h3>
            <p className="text-sm mt-0.5" style={{ color: "rgba(200,210,230,0.60)" }}>
              Para administradoras de propiedades con 20+ unidades · Custom pricing for property managers
            </p>
          </div>
          <a
            href="mailto:hola@prcontract.online"
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(200,210,230,0.90)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Contáctanos · Contact us
          </a>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center mt-12">
        <Link
          href="/login"
          className="text-sm"
          style={{ color: "rgba(200,210,230,0.40)" }}
        >
          ← Volver · Back to login
        </Link>
      </div>
    </div>
  );
}
