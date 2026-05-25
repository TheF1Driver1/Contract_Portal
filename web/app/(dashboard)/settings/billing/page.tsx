"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CreditCard, Zap, Check, ArrowUpRight, Users } from "lucide-react";
import Link from "next/link";
import type { SubscriptionPlan } from "@/lib/types";
import { PLAN_LIMITS, planDisplayName } from "@/lib/subscription";

const S = {
  bg: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text: "rgba(200,210,230,0.80)",
  muted: "rgba(200,210,230,0.45)",
  accent: "#007aff",
};

const tierDetails: Record<SubscriptionPlan, {
  price: string;
  description: string;
  color: string;
}> = {
  free:          { price: "$0/mes",         description: "1 propiedad · 3 contratos/mes",                         color: "rgba(200,210,230,0.50)" },
  propietario:   { price: "$29/mes",        description: "Hasta 5 propiedades · Contratos ilimitados",            color: "#30d158" },
  inversionista: { price: "$99/mes",        description: "Propiedades ilimitadas · Schedule E · Administradores", color: "#007aff" },
  enterprise:    { price: "Personalizado",  description: "Para administradoras de propiedades",                   color: "#bf5af2" },
};

const upgradeFeatures: { plan: Exclude<SubscriptionPlan, "free">; features: string[] }[] = [
  {
    plan: "propietario",
    features: [
      "Hasta 5 propiedades",
      "Contratos ilimitados",
      "Envío por SMS",
      "Exportación de gastos (CSV)",
      "Plantillas conformes a Ley 14-2022",
      "Análisis de mercado y lista de seguimiento",
    ],
  },
  {
    plan: "inversionista",
    features: [
      "Propiedades ilimitadas",
      "Reporte Schedule E (IRS)",
      "Panel de portafolio Act 60",
      "Hasta 3 administradores de propiedad",
      "Soporte prioritario (48h SLA)",
      "Documentos de cumplimiento Act 60",
    ],
  },
];

export default function BillingPage() {
  const supabase = createClient();
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [propertyCount, setPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).single(),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      ]);

      if (profile?.plan) setPlan(profile.plan as SubscriptionPlan);
      setPropertyCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const limits = PLAN_LIMITS[plan];
  const detail = tierDetails[plan];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Facturación</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>
          Administra tu suscripción y método de pago
        </p>
      </div>

      {/* Current plan card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: S.bg, border: `1px solid ${S.border}` }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: S.muted }}>
              Plan actual
            </p>
            <div className="flex items-center gap-3">
              <span
                className="text-2xl font-bold"
                style={{ color: detail.color }}
              >
                {planDisplayName(plan)}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: `${detail.color}18`, color: detail.color, border: `1px solid ${detail.color}30` }}
              >
                {detail.price}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: S.muted }}>
              {detail.description}
            </p>
          </div>

          {plan !== "free" && (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: S.text, border: `1px solid ${S.border}` }}
              onClick={() => { window.location.href = "/api/billing/portal"; }}
            >
              <CreditCard size={14} />
              Administrar facturación
            </button>
          )}
        </div>

        {/* Usage */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Propiedades",
              used: propertyCount,
              max: limits.max_properties === Infinity ? "∞" : limits.max_properties,
              overLimit: limits.max_properties !== Infinity && propertyCount >= limits.max_properties,
            },
            { label: "SMS", used: limits.sms ? "✓" : "✗", max: null, overLimit: !limits.sms },
            { label: "Schedule E", used: limits.schedule_e ? "✓" : "✗", max: null, overLimit: !limits.schedule_e },
            { label: "Administradores", used: 0, max: limits.managers === Infinity ? "∞" : limits.managers, overLimit: false },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${stat.overLimit ? "rgba(255,69,58,0.30)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: S.muted }}>
                {stat.label}
              </p>
              <p
                className="text-lg font-bold"
                style={{ color: stat.overLimit ? "#ff453a" : "rgba(200,210,230,0.90)" }}
              >
                {stat.max !== null ? `${stat.used} / ${stat.max}` : stat.used}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade options */}
      {plan !== "inversionista" && plan !== "enterprise" && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Mejorar plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upgradeFeatures
              .filter((t) =>
                plan === "free"
                  ? true
                  : t.plan === "inversionista"
              )
              .map(({ plan: upgradePlan, features }) => {
                const d = tierDetails[upgradePlan];
                return (
                  <div
                    key={upgradePlan}
                    className="rounded-2xl p-5 flex flex-col"
                    style={{
                      background: upgradePlan === "inversionista"
                        ? "rgba(0,122,255,0.08)"
                        : "rgba(48,209,88,0.06)",
                      border: `1px solid ${upgradePlan === "inversionista"
                        ? "rgba(0,122,255,0.25)"
                        : "rgba(48,209,88,0.20)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-white">{planDisplayName(upgradePlan)}</p>
                        <p className="text-sm" style={{ color: d.color }}>{d.price}</p>
                      </div>
                      <Zap size={18} style={{ color: d.color }} />
                    </div>
                    <ul className="space-y-2 flex-1 mb-5">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm" style={{ color: S.text }}>
                          <Check size={13} style={{ color: d.color }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/pricing"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: upgradePlan === "inversionista" ? "#007aff" : "rgba(48,209,88,0.20)",
                        color: "#fff",
                      }}
                    >
                      Mejorar a {planDisplayName(upgradePlan)}
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Managers shortcut */}
      {(plan === "inversionista" || plan === "enterprise") && (
        <Link
          href="/settings/managers"
          className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-all"
          style={{ background: S.bg, border: `1px solid ${S.border}` }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(0,122,255,0.12)" }}>
            <Users size={16} style={{ color: S.accent }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Property Managers</p>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>Invite team members to manage properties on your behalf</p>
          </div>
          <ArrowUpRight size={14} style={{ color: S.muted }} />
        </Link>
      )}

      {/* Legal */}
      <p className="text-xs" style={{ color: "rgba(200,210,230,0.25)" }}>
        Los precios están en USD. Puedes cancelar en cualquier momento.
        Al actualizar, se le cobrará de forma prorrateada por el resto del período de facturación actual.
      </p>
    </div>
  );
}
