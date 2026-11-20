import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch } from "@/lib/auth";
import { KitchenBoard, type KitchenStationItem, type KitchenOrder } from "./kitchen-board";

export default async function KitchenPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "kitchen";
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};
  const [tickets, stations] = restaurantId
    ? await Promise.all([
        serverFetch<KitchenOrder[]>("/kitchen/tickets", headers),
        serverFetch<KitchenStationItem[]>("/kitchen/stations", headers),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <PageHeader title="Kitchen board" description="Active tickets, station routing, live updates and order notes." />
      {restaurantId ? (
        <KitchenBoard
          restaurantId={restaurantId}
          role={role}
          initial={tickets ?? []}
          initialStations={stations ?? []}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant is selected.</p>
      )}
    </div>
  );
}
