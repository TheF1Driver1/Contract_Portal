"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Loader2, Save } from "lucide-react";
import type { BusinessGroupMember, GroupPropertyOwnership, Property } from "@/lib/types";

interface Props {
  groupId: string;
  properties: Property[];
  members: BusinessGroupMember[];
  ownership: GroupPropertyOwnership[];
  isAdmin: boolean;
}

export default function OwnershipTable({ groupId, properties, members, ownership, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Local state: pct[propertyId][userId] = string value
  const [pcts, setPcts] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    properties.forEach((p) => {
      init[p.id] = {};
      members.forEach((m) => {
        const row = ownership.find((o) => o.property_id === p.id && o.user_id === m.user_id);
        init[p.id][m.user_id] = row ? String(row.ownership_pct) : "0";
      });
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function getTotal(propertyId: string) {
    return Object.values(pcts[propertyId] ?? {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }

  async function save() {
    // Validate no property exceeds 100%
    for (const p of properties) {
      if (getTotal(p.id) > 100) {
        setError(`${p.name} ownership total exceeds 100%`);
        return;
      }
    }
    setSaving(true);
    setError("");

    const upserts: any[] = [];
    properties.forEach((p) => {
      members.forEach((m) => {
        upserts.push({
          group_id: groupId,
          property_id: p.id,
          user_id: m.user_id,
          ownership_pct: parseFloat(pcts[p.id]?.[m.user_id] ?? "0") || 0,
        });
      });
    });

    const { error: err } = await supabase
      .from("group_property_ownership")
      .upsert(upserts, { onConflict: "group_id,property_id,user_id" });

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  if (properties.length === 0 || members.length === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
        Add properties and members to configure ownership.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-container)" }}>
              <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Property
              </th>
              {members.map((m) => (
                <th key={m.user_id} className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}
                </th>
              ))}
              <th className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const total = getTotal(p.id);
              const over = total > 100;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-xs" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.city}</p>
                  </td>
                  {members.map((m) => (
                    <td key={m.user_id} className="px-3 py-3 text-center">
                      {isAdmin ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            className="input-tonal w-16 text-center text-xs py-1 px-2"
                            value={pcts[p.id]?.[m.user_id] ?? "0"}
                            onChange={(e) =>
                              setPcts((prev) => ({
                                ...prev,
                                [p.id]: { ...prev[p.id], [m.user_id]: e.target.value },
                              }))
                            }
                          />
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {pcts[p.id]?.[m.user_id] ?? "0"}%
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                      style={{
                        background: over ? "rgba(239,68,68,0.12)" : total === 100 ? "rgba(34,197,94,0.12)" : "var(--surface-container)",
                        color: over ? "#ef4444" : total === 100 ? "#22c55e" : "var(--text-secondary)",
                      }}
                    >
                      {total}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

      {isAdmin && (
        <button
          className="btn-primary-gradient flex items-center gap-2"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Ownership
        </button>
      )}
    </div>
  );
}
