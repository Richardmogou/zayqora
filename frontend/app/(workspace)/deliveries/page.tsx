import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import {
  DeliveriesBoard,
  type DeliveryAssignmentItem,
  type DeliveryOrderOption,
  type RiderOption,
} from "./deliveries-board";

export default async function DeliveriesPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "rider";
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const canAssign = role === "owner" || role === "manager" || role === "cashier";
  const [restaurant, assignments, orders, members] = restaurantId
    ? await Promise.all([
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
        serverFetch<DeliveryAssignmentItem[]>("/deliveries", headers),
        canAssign ? serverFetch<DeliveryOrderOption[]>("/orders", headers) : Promise.resolve([]),
        canAssign ? serverFetch<RiderOption[]>("/members", headers) : Promise.resolve([]),
      ])
    : [null, null, null, null];

  const deliveryOrders = (orders ?? []).filter(
    (o) => o.service_mode === "delivery" && o.status !== "cancelled" && o.status !== "served"
  );
  const sym = currencySymbol(restaurant?.currency ?? "EUR");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery operations"
        description={
          role === "rider"
            ? "View your assigned deliveries and update pickup and handover milestones."
            : "Dispatch delivery orders to riders and track handover milestones."
        }
      />
      {restaurantId ? (
        <DeliveriesBoard
          restaurantId={restaurantId}
          sym={sym}
          role={role}
          initialAssignments={assignments ?? []}
          deliveryOrders={deliveryOrders}
          riders={members ?? []}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant is selected.</p>
      )}
    </div>
  );
}
