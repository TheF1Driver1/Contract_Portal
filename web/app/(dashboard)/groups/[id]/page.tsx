import { createClient } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Building2, Users, ArrowLeft, Crown, Shield, User } from "lucide-react";
import type { BusinessGroupMember, BusinessGroupProperty, GroupPropertyOwnership, Property } from "@/lib/types";
import InviteMemberModal from "./InviteMemberModal";
import AddPropertyToGroupModal from "./AddPropertyToGroupModal";
import OwnershipTable from "./OwnershipTable";

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_COLOR: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#007aff",
  member: "var(--text-muted)",
};

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: group }, { data: membersData }, { data: groupPropsData }, { data: ownershipData }, { data: allProps }] =
    await Promise.all([
      supabase.from("business_groups").select("*").eq("id", params.id).single(),
      supabase
        .from("business_group_members")
        .select("*, profile:profiles(id, full_name, email)")
        .eq("group_id", params.id)
        .order("joined_at"),
      supabase
        .from("business_group_properties")
        .select("*, property:properties(*)")
        .eq("group_id", params.id),
      supabase
        .from("group_property_ownership")
        .select("*, profile:profiles(id, full_name, email)")
        .eq("group_id", params.id),
      supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    ]);

  if (!group) notFound();

  const members = (membersData ?? []) as BusinessGroupMember[];
  const groupProps = (groupPropsData ?? []) as BusinessGroupProperty[];
  const ownership = (ownershipData ?? []) as GroupPropertyOwnership[];
  const groupPropertyIds = new Set(groupProps.map((gp) => gp.property_id));
  const availableProperties = ((allProps ?? []) as Property[]).filter((p) => !groupPropertyIds.has(p.id));
  const groupPropertyList = groupProps.map((gp) => gp.property).filter(Boolean) as Property[];

  const currentMember = members.find((m) => m.user_id === user.id);
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up">
        <Link
          href="/groups"
          className="flex items-center gap-1.5 text-xs font-medium mb-4 hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="h-3 w-3" />
          All Groups
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Group
            </p>
            <h1
              className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
              style={{ letterSpacing: "-0.03em" }}
            >
              {group.name}
            </h1>
          </div>
          {isAdmin && <InviteMemberModal groupId={params.id} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members */}
        <div className="surface-card p-6 animate-slide-up" style={{ animationDelay: "0.06s", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Members ({members.length})
            </h2>
          </div>
          <div className="space-y-2">
            {members.map((m) => {
              const RoleIcon = ROLE_ICON[m.role] ?? User;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl p-3"
                  style={{ background: "var(--surface-container)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {m.profile?.full_name ?? m.profile?.email}
                      {m.user_id === user.id && (
                        <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>(you)</span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{m.profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <RoleIcon className="h-3.5 w-3.5" style={{ color: ROLE_COLOR[m.role] }} />
                    <span className="text-xs font-medium capitalize" style={{ color: ROLE_COLOR[m.role] }}>
                      {m.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Properties */}
        <div className="surface-card p-6 animate-slide-up" style={{ animationDelay: "0.10s", animationFillMode: "both" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Properties ({groupPropertyList.length})
              </h2>
            </div>
            {isAdmin && <AddPropertyToGroupModal groupId={params.id} availableProperties={availableProperties} />}
          </div>
          {groupPropertyList.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
              No properties added yet.
            </p>
          ) : (
            <div className="space-y-2">
              {groupPropertyList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: "var(--surface-container)" }}
                >
                  <Building2 className="h-4 w-4 shrink-0" style={{ color: "#007aff" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{p.city}, {p.state}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ownership Table */}
      <div className="surface-card p-6 animate-slide-up" style={{ animationDelay: "0.14s", animationFillMode: "both" }}>
        <div className="mb-5">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Ownership Breakdown
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Set each member's ownership % per property. Total per property should not exceed 100%.
          </p>
        </div>
        <OwnershipTable
          groupId={params.id}
          properties={groupPropertyList}
          members={members}
          ownership={ownership}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
