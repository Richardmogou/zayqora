import { getCurrentUser, serverFetch } from "@/lib/auth";
import { InventoryManager, type IngredientItem, type StockMovementItem } from "./inventory-manager";

export default async function InventoryPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "owner";
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const [items, movements] = restaurantId
    ? await Promise.all([
        serverFetch<IngredientItem[]>("/inventory/items", headers),
        serverFetch<StockMovementItem[]>("/inventory/movements", headers),
      ])
    : [null, null];

  return restaurantId ? (
    <InventoryManager
      restaurantId={restaurantId}
      initialItems={items ?? []}
      initialMovements={movements ?? []}
      canEdit={role === "owner" || role === "manager" || role === "kitchen"}
    />
  ) : (
    <p className="text-sm text-muted-foreground">No restaurant workspace selected.</p>
  );
}
