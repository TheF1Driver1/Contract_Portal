import { createClient } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import {
  ArrowLeft,
  Download,
  Send,
  User,
  Building2,
  DollarSign,
  Calendar,
  Key,
} from "lucide-react";
import ContractActions from "./ContractActions";

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) notFound();

  const c = contract as Contract;
  const daysLeft = daysUntil(c.lease_end);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/contracts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {c.tenant?.full_name}
              </h1>
              <Badge variant={c.status as "draft" | "sent" | "signed" | "expired"}>
                {c.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{c.property?.name}</p>
          </div>
        </div>
        <ContractActions contract={c} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tenant Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Name" value={c.tenant?.full_name} />
            <InfoRow label="Email" value={c.tenant?.email} />
            <InfoRow label="Phone" value={c.tenant?.phone} />
            <InfoRow label="License #" value={c.tenant?.license_number} />
            <InfoRow label="SSN (last 4)" value={c.tenant?.ssn_last4 ? `xxx-xx-${c.tenant.ssn_last4}` : null} />
            <InfoRow label="Current Address" value={c.tenant?.current_address} />
            <InfoRow
              label="Occupants"
              value={c.occupant_names?.length ? c.occupant_names.join(", ") : String(c.occupant_count)}
            />
          </CardContent>
        </Card>

        {/* Property */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Property" value={c.property?.name} />
            <InfoRow label="Address" value={c.property?.address} />
            <InfoRow label="City" value={`${c.property?.city}, ${c.property?.state}`} />
            <InfoRow label="Unit" value={c.unit_number} />
            {c.amenities && Object.keys(c.amenities).length > 0 && (
              <div className="pt-2">
                <p className="font-medium text-muted-foreground">Amenities</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(c.amenities).map(([k, v]) => {
                    if (v === false || v === 0) return null;
                    const label = k.replace(/_/g, " ");
                    return (
                      <span
                        key={k}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize"
                      >
                        {typeof v === "number" && v > 1 ? `${v}x ` : ""}{label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" /> Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Monthly Rent" value={formatCurrency(c.rent_amount)} />
            <InfoRow label="Security Deposit" value={formatCurrency(c.security_deposit)} />
            <InfoRow label="Due Day" value={`${c.payment_due_day}th of month`} />
            <InfoRow label="Late After" value={`Day ${c.late_fee_day}`} />
            <InfoRow label="Keys" value={String(c.key_count)} />
          </CardContent>
        </Card>

        {/* Lease */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" /> Lease
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Start" value={formatDate(c.lease_start)} />
            <InfoRow label="End" value={formatDate(c.lease_end)} />
            <InfoRow label="Duration" value={`${c.lease_months} months`} />
            <InfoRow
              label="Days Remaining"
              value={
                daysLeft < 0
                  ? "Expired"
                  : daysLeft <= 30
                  ? `${daysLeft} days ⚠️`
                  : `${daysLeft} days`
              }
            />
            {c.signed_at && (
              <InfoRow label="Signed" value={formatDate(c.signed_at)} />
            )}
            {c.sent_at && (
              <InfoRow label="Sent" value={formatDate(c.sent_at)} />
            )}
            {c.opened_at && (
              <InfoRow label="Opened" value={formatDate(c.opened_at)} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signatures preview */}
      {(c.landlord_signature || c.tenant_signature) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Signatures</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {c.landlord_signature && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Landlord</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.landlord_signature}
                  alt="Landlord signature"
                  className="h-20 w-full rounded-lg border object-contain"
                />
              </div>
            )}
            {c.tenant_signature && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Tenant</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.tenant_signature}
                  alt="Tenant signature"
                  className="h-20 w-full rounded-lg border object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
