import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch } from "@/lib/auth";
import { NotificationList, type NotificationItem } from "./notification-list";

export default async function NotificationsPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const notifications = restaurantId
    ? await serverFetch<NotificationItem[]>("/notifications", { "X-Restaurant-Id": restaurantId })
    : null;
  return <div className="space-y-6"><PageHeader title="Notifications" description="Order and reservation activity for your restaurant." />
    {restaurantId ? <NotificationList restaurantId={restaurantId} initial={notifications ?? []} /> : <p className="text-sm text-muted-foreground">No restaurant is selected.</p>}
  </div>;
}
