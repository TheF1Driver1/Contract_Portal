"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FieldGroup } from "@/components/properties/PropertyFormSheet";
import { getTenantConsents, setTenantConsent, type ConsentView } from "@/lib/actions/messaging";

type Channel = "whatsapp" | "sms";
const CHANNELS: Channel[] = ["whatsapp", "sms"];
type Saved = Record<Channel, ConsentView>;
const NONE: Saved = { whatsapp: null, sms: null };

const isOn = (v: ConsentView) => v?.status === "opted_in";
const isStopped = (v: ConsentView) => v?.status === "opted_out" && v.source === "inbound_stop";

/**
 * Consent state for the tenant form: loads what is on record when editing,
 * and `save(tenantId)` records what changed (source "landlord_attested").
 */
export function useTenantConsent(tenantId: string | null | undefined, open: boolean) {
  const [saved, setSaved] = useState<Saved>(NONE);
  const [checked, setChecked] = useState<Record<Channel, boolean>>({ whatsapp: false, sms: false });

  useEffect(() => {
    if (!open || !tenantId) return;
    let live = true;
    getTenantConsents(tenantId)
      .then((r) => {
        if (!live || !r) return;
        setSaved(r);
        setChecked({ whatsapp: isOn(r.whatsapp), sms: isOn(r.sms) });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tenantId, open]);

  /** Returns the first error, if any. */
  async function save(id: string): Promise<string | null> {
    for (const ch of CHANNELS) {
      if (checked[ch] === isOn(saved[ch])) continue;
      const res = await setTenantConsent({ tenant_id: id, channel: ch, opted_in: checked[ch] });
      if (!res.ok) return res.error;
    }
    return null;
  }

  function reset() {
    setSaved(NONE);
    setChecked({ whatsapp: false, sms: false });
  }

  return { saved, checked, setChecked, save, reset };
}

/** "The tenant agreed to receive messages by WhatsApp / SMS" checkboxes. */
export function ConsentFields({
  hasPhone,
  saved,
  checked,
  onChange,
}: {
  hasPhone: boolean;
  saved: Saved;
  checked: Record<Channel, boolean>;
  onChange: (next: Record<Channel, boolean>) => void;
}) {
  const t = useTranslations("messaging.consent");
  const f = useFormatter();
  const uid = useId();
  const date = (iso: string) => f.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <FieldGroup title={t("title")}>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {CHANNELS.map((ch) => {
        const v = saved[ch];
        const stopped = isStopped(v);
        const id = `${uid}-${ch}`;
        const hint = stopped
          ? t("stopped", { date: date(v!.at) })
          : !hasPhone
            ? t("needsPhone")
            : v
              ? t("recorded", { date: date(v.at), source: t(`source.${v.source}`) })
              : null;
        return (
          <div key={ch} className="space-y-1">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={checked[ch]}
                disabled={!hasPhone || stopped}
                onCheckedChange={(c) => onChange({ ...checked, [ch]: c === true })}
                aria-describedby={hint ? `${id}-hint` : undefined}
              />
              <Label htmlFor={id} className="font-normal leading-snug">
                {t(ch)}
              </Label>
            </div>
            {hint && (
              <p id={`${id}-hint`} className="pl-6.5 text-xs text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
        );
      })}
    </FieldGroup>
  );
}
