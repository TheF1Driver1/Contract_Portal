"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, FilePlus, FileText, Plus, Receipt, Search, User } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase";
import { NAV_GROUPS } from "./nav";

type Entry = { id: string; label: string; hint?: string; href: string };

export function CommandMenu() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ tenants: Entry[]; properties: Entry[]; contracts: Entry[] } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load searchable records the first time the palette opens (RLS-scoped).
  useEffect(() => {
    if (!open || data) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from("tenants").select("id, full_name, email").order("full_name").limit(200),
      supabase.from("properties").select("id, name, city").order("name").limit(200),
      supabase
        .from("contracts")
        .select("id, status, lease_end, tenant:tenants(full_name), property:properties(name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]).then(([tenants, properties, contracts]) =>
      setData({
        tenants: (tenants.data ?? []).map((r) => ({ id: r.id, label: r.full_name, hint: r.email ?? undefined, href: `/tenants?q=${encodeURIComponent(r.full_name)}` })),
        properties: (properties.data ?? []).map((r) => ({ id: r.id, label: r.name, hint: r.city, href: `/properties?q=${encodeURIComponent(r.name)}` })),
        contracts: (contracts.data ?? []).map((r) => ({
          id: r.id,
          label: [r.tenant?.full_name, r.property?.name].filter(Boolean).join(" · ") || r.id.slice(0, 8),
          hint: r.status,
          href: `/contracts/${r.id}`,
        })),
      })
    );
  }, [open, data]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups: [string, Entry[], typeof User][] = data
    ? [
        [t("contracts"), data.contracts, FileText],
        [t("tenants"), data.tenants, User],
        [t("properties"), data.properties, Building2],
      ]
    : [];

  return (
    <>
      <Button
        variant="outline"
        className="h-9 min-w-0 flex-1 justify-start gap-2 text-subtle-foreground sm:w-64 sm:flex-none"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="truncate">{t("search")}</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={t("searchPlaceholder")}>
        <CommandInput placeholder={t("searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          <CommandGroup heading={t("quickActions")}>
            <CommandItem onSelect={() => go("/contracts/new")}><FilePlus />{t("newContract")}</CommandItem>
            <CommandItem onSelect={() => go("/properties?new=1")}><Plus />{t("newProperty")}</CommandItem>
            <CommandItem onSelect={() => go("/tenants?new=1")}><Plus />{t("newTenant")}</CommandItem>
            <CommandItem onSelect={() => go("/expenses?new=1")}><Receipt />{t("newExpense")}</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("navigation")}>
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon />
                {t(item.key)}
              </CommandItem>
            ))}
          </CommandGroup>
          {groups.map(([heading, entries, Icon]) =>
            entries.length ? (
              <CommandGroup key={heading} heading={heading}>
                {entries.map((e) => (
                  <CommandItem key={e.id} value={`${e.label} ${e.hint ?? ""} ${e.id}`} onSelect={() => go(e.href)}>
                    <Icon />
                    <span className="truncate">{e.label}</span>
                    {e.hint && <span className="ml-auto truncate text-xs text-subtle-foreground">{e.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
