import { getCurrentUser, serverFetch } from "@/lib/auth";
import { ReportsView, type SalesReport } from "./reports-view";

export default async function ReportsPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const initialReport = restaurantId
    ? await serverFetch<SalesReport>("/reports/sales?period=7d", { "X-Restaurant-Id": restaurantId })
    : null;

  return restaurantId ? (
    <ReportsView restaurantId={restaurantId} initialReport={initialReport} />
  ) : (
    <p className="text-sm text-muted-foreground">No restaurant workspace selected.</p>
  );
}
