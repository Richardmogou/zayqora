import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { OrdersTable, type OrderListItem } from "./orders-table";

export default async function OrdersPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};
  const [orders, restaurant] = restaurantId
    ? await Promise.all([
        serverFetch<OrderListItem[]>("/orders", headers),
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
      ])
    : [null, null];
  const sym = currencySymbol(restaurant?.currency ?? "EUR");

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Manage and track all your restaurant orders" />
      <OrdersTable orders={orders ?? []} sym={sym} />
    </div>
  );
}
