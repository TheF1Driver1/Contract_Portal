import { createClient } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Building2,
  Users,
  Plus,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import CashflowChart from "@/components/CashflowChart";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [contractsResult, propertiesResult, tenantsResult] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, property:properties(name, address), tenant:tenants(full_name, email)")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id").eq("owner_id", user!.id),
    supabase.from("tenants").select("id").eq("owner_id", user!.id),
  ]);

  const contracts = (contractsResult.data ?? []) as Contract[];
  const propertyCount = propertiesResult.data?.length ?? 0;
  const tenantCount = tenantsResult.data?.length ?? 0;

  const activeContracts = contracts.filter((c) => c.status === "signed");
  const draftContracts = contracts.filter((c) => c.status === "draft");
  const expiringContracts = activeContracts.filter((c) => {
    const days = daysUntil(c.lease_end);
    return days >= 0 && days <= 60;
  });

  const monthlyRevenue = activeContracts.reduce((sum, c) => sum + c.rent_amount, 0);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      income: 0,
    };
  });
  activeContracts.forEach((c) => {
    const start = c.lease_start.slice(0, 7);
    const end = c.lease_end.slice(0, 7);
    months.forEach((m) => {
      if (m.key >= start && m.key <= end) m.income += c.rent_amount;
    });
  });
  const cashflowData = months.map(({ label, income }) => ({ label, income }));

  const stats = [
    {
      label: "Active Leases",
      value: activeContracts.length,
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Monthly Revenue",
      value: formatCurrency(monthlyRevenue),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Properties",
      value: propertyCount,
      icon: Building2,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Tenants",
      value: tenantCount,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your rental portfolio
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Expiring Soon */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contracts expiring in 60 days.</p>
            ) : (
              <div className="space-y-3">
                {expiringContracts.map((c) => {
                  const days = daysUntil(c.lease_end);
                  return (
                    <Link
                      key={c.id}
                      href={`/contracts/${c.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.tenant?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.property?.name}</p>
                      </div>
                      <Badge variant={days <= 30 ? "destructive" : "outline"}>
                        {days}d
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Contracts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Contracts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/contracts">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No contracts yet.</p>
                <Button size="sm" asChild>
                  <Link href="/contracts/new">Create your first contract</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {contracts.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.tenant?.full_name ?? "Unknown Tenant"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.property?.name} · {formatCurrency(c.rent_amount)}/mo
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(c.created_at)}
                      </p>
                      <Badge variant={c.status as "draft" | "sent" | "signed" | "expired"}>
                        {c.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Chart */}
      {cashflowData.some((m) => m.income > 0) && (
        <div className="bg-card rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Monthly Income (6 months)</h3>
          <CashflowChart data={cashflowData} />
        </div>
      )}

      {/* Drafts */}
      {draftContracts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {draftContracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{c.tenant?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.property?.name}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/contracts/${c.id}`}>Finish</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
