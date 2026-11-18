import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { ReservationSettingsEditor, type ReservationBlock, type ReservationSettings } from "./reservation-settings";
import { ReservationsBoard, type ReservationItem } from "./reservations-board";

const DEFAULT_SETTINGS: ReservationSettings = {
  capacity: 40,
  duration_minutes: 90,
  slot_interval_minutes: 30,
  buffer_minutes: 15,
  opening_hours: {
    "0": [],
    "1": [["12:00", "14:30"], ["19:00", "22:00"]],
    "2": [["12:00", "14:30"], ["19:00", "22:00"]],
    "3": [["12:00", "14:30"], ["19:00", "22:00"]],
    "4": [["12:00", "14:30"], ["19:00", "22:00"]],
    "5": [["12:00", "14:30"], ["19:00", "22:00"]],
    "6": [["12:00", "14:30"], ["19:00", "22:00"]],
  },
};

export default async function ReservationsPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "owner";
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};
  const restaurant = restaurantId ? await serverFetch<RestaurantInfo>("/restaurants/me", headers) : null;
  const timeZone = restaurant?.timezone ?? "UTC";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const [reservations, settings, blocks] = restaurantId
    ? await Promise.all([
        serverFetch<ReservationItem[]>(`/reservations?date=${today}`, headers),
        serverFetch<ReservationSettings>("/reservations/settings", headers),
        serverFetch<ReservationBlock[]>("/reservations/blocks", headers),
      ])
    : [null, null, null];

  const effectiveSettings = settings ?? DEFAULT_SETTINGS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Manage table bookings, walk-ins, table assignments and service availability."
      />
      {restaurantId && (
        <>
          <ReservationsBoard
            restaurantId={restaurantId}
            initialDate={today}
            initialReservations={reservations ?? []}
            capacity={effectiveSettings.capacity}
            timeZone={timeZone}
            role={role}
          />
          <ReservationSettingsEditor
            restaurantId={restaurantId}
            initial={effectiveSettings}
            blocks={blocks ?? []}
            canEdit={role === "owner" || role === "manager"}
          />
        </>
      )}
    </div>
  );
}
