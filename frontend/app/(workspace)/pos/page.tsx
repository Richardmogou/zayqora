import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { PosTerminal, type CashSessionItem, type PosCategory, type PosMenuItem } from "./pos-terminal";

export default async function PosPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "cashier";
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const [restaurant, categories, items, tables, sessions] = restaurantId
    ? await Promise.all([
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
        serverFetch<PosCategory[]>("/menu/categories", headers),
        serverFetch<PosMenuItem[]>("/menu/items", headers),
        serverFetch<{ label: string }[]>("/tables", headers),
        serverFetch<CashSessionItem[]>("/pos/sessions", headers),
      ])
    : [null, null, null, null, null];

  const sym = currencySymbol(restaurant?.currency ?? "EUR");

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS-Lite & Cash Drawer"
        description="Fast dine-in, takeaway and counter order entry with cash drawer reconciliation."
      />
      {restaurantId ? (
        <PosTerminal
          restaurantId={restaurantId}
          sym={sym}
          role={role}
          categories={categories ?? []}
          items={items ?? []}
          tables={(tables ?? []).map((t) => t.label)}
          initialSessions={sessions ?? []}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant is selected.</p>
      )}
    </div>
  );
}
