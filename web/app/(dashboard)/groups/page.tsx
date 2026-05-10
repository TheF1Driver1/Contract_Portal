import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, Users } from "lucide-react";
import type { BusinessGroup } from "@/lib/types";
import CreateGroupModal from "./CreateGroupModal";

export default async function GroupsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Groups created by user
  const { data: ownedGroups } = await supabase
    .from("business_groups")
    .select("*, members:business_group_members(id)")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  // Groups user is a member of (but didn't create)
  const { data: memberRows } = await supabase
    .from("business_group_members")
    .select("group:business_groups(*, members:business_group_members(id))")
    .eq("user_id", user.id)
    .neq("role", "owner");

  const memberGroups = ((memberRows ?? []) as any[])
    .map((r) => r.group)
    .filter(Boolean) as BusinessGroup[];

  const allGroups = [
    ...(ownedGroups ?? []) as BusinessGroup[],
    ...memberGroups.filter((g) => !(ownedGroups ?? []).find((o: any) => o.id === g.id)),
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Business
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Groups
          </h1>
        </div>
        <CreateGroupModal />
      </div>

      {allGroups.length === 0 ? (
        <div
          className="surface-card p-12 flex flex-col items-center gap-4 text-center animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <Briefcase className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No groups yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Create a group to manage properties with partners
            </p>
          </div>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          {allGroups.map((g, i) => {
            const memberCount = (g as any).members?.length ?? 0;
            const isOwner = (ownedGroups ?? []).find((o: any) => o.id === g.id);
            return (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="surface-card p-5 flex items-start gap-3 transition-opacity hover:opacity-80"
                style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(245,158,11,0.10)" }}
                >
                  <Briefcase className="h-5 w-5" style={{ color: "#f59e0b" }} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {g.name}
                    </p>
                    {isOwner && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                      >
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Users className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
