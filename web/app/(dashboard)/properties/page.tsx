import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";
import type { Property } from "@/lib/types";
import AddPropertyModal from "./AddPropertyModal";

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", user.id)
    .order("name");

  const all = (properties ?? []) as Property[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground">{all.length} properties</p>
        </div>
        <AddPropertyModal userId={user.id} />
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No properties yet</p>
          <p className="text-sm text-muted-foreground">Add a property to start creating contracts.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.city}, {p.state}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.unit_count} unit{p.unit_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
