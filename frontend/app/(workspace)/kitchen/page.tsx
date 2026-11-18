import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch } from "@/lib/auth";
import { KitchenBoard } from "./kitchen-board";

type KitchenOrder = {
  id: string; customer_name: string; service_mode: string; table_label: string | null; status: string;
  created_at: string; special_instructions: string | null;
  lines: { id: string; name: string; quantity: number; modifiers_snapshot: { name: string }[] | null }[];
};

export default async function KitchenPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const orders = restaurantId ? await serverFetch<KitchenOrder[]>("/orders/kitchen", { "X-Restaurant-Id": restaurantId }) : null;
  return <div className="space-y-6"><PageHeader title="Kitchen board" description="Active tickets, item modifiers and order notes." />
    {restaurantId ? <KitchenBoard restaurantId={restaurantId} initial={orders ?? []} /> : <p className="text-sm text-muted-foreground">No restaurant is selected.</p>}
  </div>;
}
