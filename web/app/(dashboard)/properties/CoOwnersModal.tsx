"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Search, Loader2, Trash2, Check, Clock, XCircle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import type { Property, PropertyCoOwner } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ProfileResult {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string;
}

const STATUS = {
  accepted: { icon: Check, className: "bg-success-soft text-success" },
  declined: { icon: XCircle, className: "bg-danger-soft text-danger" },
  pending: { icon: Clock, className: "bg-surface-muted text-muted-foreground" },
} as const;

/** Invite, list and remove co-owners of one property. */
export default function CoOwnersModal({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("properties.coOwners");
  const uid = useId();
  const [coOwners, setCoOwners] = useState<PropertyCoOwner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [ownershipPct, setOwnershipPct] = useState("");
  const [pctError, setPctError] = useState(false);
  const [saving, setSaving] = useState(false);
  // The dialog is mounted when opened, so the first fetch starts right away.
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());

  const loadCoOwners = useCallback(
    () =>
      supabase
        .from("property_co_owners")
        .select("*, co_owner:profiles!property_co_owners_co_owner_id_fkey(id, full_name, email)")
        .eq("property_id", property.id)
        .order("invited_at", { ascending: false }),
    [property.id, supabase]
  );

  const applyCoOwners = useCallback(
    ({ data, error }: { data: unknown[] | null; error: unknown }) => {
      if (error) toast.error(t("loadFailed"));
      setCoOwners((data ?? []) as PropertyCoOwner[]);
      setLoading(false);
    },
    [t]
  );

  const fetchCoOwners = useCallback(
    async () => applyCoOwners(await loadCoOwners()),
    [loadCoOwners, applyCoOwners]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadCoOwners().then((res) => {
      if (!cancelled) applyCoOwners(res);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loadCoOwners, applyCoOwners]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_profiles", {
        query: searchQuery.trim(),
      });
      setSearchResults((data ?? []) as ProfileResult[]);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, supabase]);

  async function addCoOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    const pct = parseFloat(ownershipPct);
    if (!pct || pct <= 0 || pct > 100) {
      setPctError(true);
      return;
    }
    setPctError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("property_co_owners").insert({
      property_id: property.id,
      owner_id: user.id,
      co_owner_id: selectedUser.id,
      ownership_pct: pct,
    });
    setSaving(false);
    if (error) {
      toast.error(t("inviteFailed"));
      return;
    }
    toast.success(t("invited"));
    setSelectedUser(null);
    setSearchQuery("");
    setOwnershipPct("");
    setSearchResults([]);
    await fetchCoOwners();
    router.refresh();
  }

  async function removeCoOwner(id: string) {
    const { error } = await supabase.from("property_co_owners").delete().eq("id", id);
    if (error) toast.error(t("removeFailed"));
    else toast.success(t("removed"));
    await fetchCoOwners();
    router.refresh();
  }

  const searchId = `${uid}-search`;
  const pctId = `${uid}-pct`;
  const resultsId = `${uid}-results`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{property.name}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2" aria-labelledby={`${uid}-current`}>
          <h3 id={`${uid}-current`} className="text-sm font-semibold text-foreground">
            {t("current")}
          </h3>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-subtle-foreground" aria-hidden />
            </div>
          ) : coOwners.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="space-y-2">
              {coOwners.map((co) => {
                const name = co.co_owner?.full_name ?? co.co_owner?.email ?? "";
                const status = STATUS[co.status] ?? STATUS.pending;
                const StatusIcon = status.icon;
                return (
                  <li key={co.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{co.co_owner?.email}</p>
                    </div>
                    <span className="tabular rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                      {co.ownership_pct}%
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        status.className
                      )}
                    >
                      <StatusIcon className="size-3.5" aria-hidden />
                      {t(`status.${co.status in STATUS ? co.status : "pending"}`)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 text-danger hover:bg-danger-soft hover:text-danger md:size-8"
                      aria-label={t("remove", { name })}
                      onClick={() => removeCoOwner(co.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form onSubmit={addCoOwner} className="space-y-3 rounded-lg border border-border bg-surface-muted p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("add")}</h3>

          <div className="space-y-1.5">
            <Label htmlFor={searchId}>{t("search")}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                aria-hidden
              />
              <Input
                id={searchId}
                className="pl-8 pr-8"
                placeholder={t("searchPlaceholder")}
                autoComplete="off"
                aria-controls={resultsId}
                value={selectedUser ? `@${selectedUser.username ?? selectedUser.email}` : searchQuery}
                onChange={(e) => {
                  setSelectedUser(null);
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length < 2) setSearchResults([]);
                }}
              />
              {searching && (
                <Loader2
                  className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground"
                  aria-label={t("searching")}
                />
              )}
            </div>
          </div>

          {!selectedUser && searchResults.length > 0 && (
            <ul
              id={resultsId}
              aria-label={t("results")}
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                    onClick={() => {
                      setSelectedUser(r);
                      setSearchResults([]);
                    }}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {r.username ? `@${r.username}` : r.email}
                      {r.full_name && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.full_name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={pctId}>{t("pct")}</Label>
            <Input
              id={pctId}
              type="number"
              inputMode="decimal"
              min={1}
              max={100}
              step={0.5}
              placeholder={t("pctPlaceholder")}
              value={ownershipPct}
              aria-invalid={pctError || undefined}
              aria-describedby={pctError ? `${pctId}-error` : undefined}
              onChange={(e) => {
                setOwnershipPct(e.target.value);
                setPctError(false);
              }}
            />
            {pctError && (
              <p id={`${pctId}-error`} className="text-xs text-danger">
                {t("pctInvalid")}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!selectedUser || !ownershipPct || saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {t("invite")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
