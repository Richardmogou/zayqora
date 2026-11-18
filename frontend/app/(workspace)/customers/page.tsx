import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { CustomersView, type CustomerListResponse } from "./customers-view";

const EMPTY_CRM: CustomerListResponse = {
  total_customers: 0,
  repeat_customers: 0,
  new_customers: 0,
  total_revenue_minor: 0,
  customers: [],
};

export default async function CustomersPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const [crm, restaurant] = restaurantId
    ? await Promise.all([
        serverFetch<CustomerListResponse>("/customers", headers),
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
      ])
    : [null, null];

  return <CustomersView initialData={crm ?? EMPTY_CRM} currency={restaurant?.currency ?? "EUR"} />;
}
