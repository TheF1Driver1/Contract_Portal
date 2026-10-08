"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, Clock, Loader2, Lock, Mail, Trash2, Users, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import type { PropertyManager, SubscriptionPlan } from "@/lib/types";
import { canInviteManager, getMaxManagers } from "@/lib/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<PropertyManager["status"], { icon: LucideIcon; className: string }> = {
  pending: { icon: Clock, className: "bg-warning-soft text-warning" },
  accepted: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  declined: { icon: XCircle, className: "bg-danger-soft text-danger" },
  revoked: { icon: Ban, className: "bg-surface-muted text-muted-foreground" },
};

const PERMISSIONS = ["view", "create_contracts", "sign_contracts"] as const;

function ManagerStatus({ status }: { status: PropertyManager["status"] }) {
  const t = useTranslations("settings.managersPage.status");
  const s = STATUS_STYLES[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

export default function ManagersSettingsPage() {
  const t = useTranslations("settings.managersPage");
  const [managers, setManagers] = useState<PropertyManager[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PropertyManager | null>(null);

  const [email, setEmail] = useState("");
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [perms, setPerms] = useState({ view: true, create_contracts: true, sign_contracts: false });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const [mgRes, propRes, profRes] = await Promise.all([
        fetch("/api/managers"),
        supabase.from("properties").select("id, name").eq("owner_id", user!.id),
        supabase.from("profiles").select("plan").eq("id", user!.id).single(),
      ]);
      setManagers(mgRes.ok ? await mgRes.json() : []);
      setProperties(propRes.data ?? []);
      setPlan((profRes.data?.plan ?? "free") as SubscriptionPlan);
    } finally {
      setLoading(false);
    }
  }

  const activeCount = managers.filter((m) => ["pending", "accepted"].includes(m.status)).length;
  const maxManagers = getMaxManagers(plan);
  const canInvite = canInviteManager(plan, activeCount);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || selectedProps.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_email: email, property_ids: selectedProps, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("inviteError"));
      toast.success(t("inviteSent", { email }));
      setEmail("");
      setSelectedProps([]);
      setPerms({ view: true, create_contracts: true, sign_contracts: false });
      await loadAll();
    } catch (err) {
      toast.error(t("inviteError"), { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/managers/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast.error(t("revokeError"));
      return;
    }
    setManagers((prev) => prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m)));
    toast.success(t("revoked"));
  }

  function toggleProp(id: string, checked: boolean) {
    setSelectedProps((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)));
  }

  const activeManagers = managers.filter((m) => m.status !== "revoked" && m.status !== "declined");
  const pastManagers = managers.filter((m) => m.status === "revoked" || m.status === "declined");

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader title={t("title")} description={t("description")} />

      {/* Plan gate */}
      {!loading && maxManagers === 0 && (
        <Card className="gap-4 py-4 md:py-5">
          <CardHeader className="flex items-start gap-3 px-4 md:px-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Lock className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">
                <h3>{t("gateTitle")}</h3>
              </CardTitle>
              <CardDescription className="mt-1">{t("gateBody")}</CardDescription>
              <Button asChild className="mt-3 h-10 sm:h-9">
                <Link href="/pricing">{t("upgrade")}</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Invite form */}
      {!loading && maxManagers > 0 && (
        <Card className="gap-4 py-4 md:py-5">
          <CardHeader className="px-4 md:px-5">
            <CardTitle className="text-base">
              <h3>{t("inviteTitle")}</h3>
            </CardTitle>
            <CardAction>
              <Badge variant="secondary" className="tabular">
                {t("used", { count: activeCount, max: maxManagers === Infinity ? "∞" : String(maxManagers) })}
              </Badge>
            </CardAction>
            {!canInvite && <CardDescription>{t("limitReached")}</CardDescription>}
          </CardHeader>
          <CardContent className="px-4 md:px-5">
            <form onSubmit={handleInvite} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="manager-email">{t("emailLabel")}</Label>
                <Input
                  id="manager-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  disabled={!canInvite}
                  className="h-10 sm:h-9"
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t("propertiesLabel")}</legend>
                {properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noProperties")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {properties.map((p) => {
                      const id = `prop-${p.id}`;
                      return (
                        <div key={p.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3">
                          <Checkbox
                            id={id}
                            checked={selectedProps.includes(p.id)}
                            onCheckedChange={(c) => toggleProp(p.id, c === true)}
                            disabled={!canInvite}
                          />
                          <Label htmlFor={id} className="flex-1 cursor-pointer py-2 font-normal">{p.name}</Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t("permissionsLabel")}</legend>
                {PERMISSIONS.map((key) => {
                  const id = `perm-${key}`;
                  return (
                    <div key={key} className="flex min-h-10 items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={perms[key]}
                        onCheckedChange={(c) => setPerms((prev) => ({ ...prev, [key]: c === true }))}
                        disabled={key === "view" || !canInvite}
                      />
                      <Label htmlFor={id} className="cursor-pointer font-normal">{t(`perm.${key}`)}</Label>
                    </div>
                  );
                })}
              </fieldset>

              <Button
                type="submit"
                disabled={saving || !canInvite || !email || selectedProps.length === 0}
                className="h-10 sm:h-9"
              >
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
                {saving ? t("sending") : t("send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active and pending */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : activeManagers.length > 0 ? (
        <section aria-labelledby="active-managers" className="space-y-3">
          <h3 id="active-managers" className="text-base font-semibold text-foreground">{t("activeTitle")}</h3>
          <ul className="space-y-2">
            {activeManagers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 md:p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                  <Users className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{m.manager_email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("propertyCount", { count: m.property_ids.length })}
                  </p>
                </div>
                <ManagerStatus status={m.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-danger hover:bg-danger-soft hover:text-danger sm:size-9"
                  onClick={() => setRevokeTarget(m)}
                  aria-label={t("revokeAria", { email: m.manager_email })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : maxManagers > 0 ? (
        <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : null}

      {/* Revoked / declined */}
      {pastManagers.length > 0 && (
        <section aria-labelledby="past-managers" className="space-y-3">
          <h3 id="past-managers" className="text-base font-semibold text-foreground">{t("pastTitle")}</h3>
          <ul className="space-y-2">
            {pastManagers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{m.manager_email}</p>
                <ManagerStatus status={m.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={t("revokeTitle")}
        description={revokeTarget ? t("revokeBody", { email: revokeTarget.manager_email }) : undefined}
        confirmLabel={t("revokeConfirm")}
        onConfirm={() => (revokeTarget ? handleRevoke(revokeTarget.id) : undefined)}
      />
    </div>
  );
}
