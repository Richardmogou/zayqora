import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch } from "@/lib/auth";
import { TablesManager, type DiningTableItem } from "./tables-manager";

export default async function TablesPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const restaurantSlug = membership?.restaurant_slug ?? "";
  const role = membership?.role ?? "waiter";
  const tables = restaurantId
    ? await serverFetch<DiningTableItem[]>("/tables", { "X-Restaurant-Id": restaurantId })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables & QR Ordering"
        description="Manage dining areas, floor occupancy and revocable table QR ordering tokens."
      />
      {restaurantId ? (
        <TablesManager
          restaurantId={restaurantId}
          restaurantSlug={restaurantSlug}
          role={role}
          initialTables={tables ?? []}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant is selected.</p>
      )}
    </div>
  );
}
