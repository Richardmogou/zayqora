import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { ReservationActions } from "./reservation-actions";
import { ReservationSettingsEditor, type ReservationBlock, type ReservationSettings } from "./reservation-settings";

type Reservation = {
  id: string; customer_name: string; customer_phone: string | null; customer_email: string | null;
  guests: number; table_label: string | null; reserved_at: string; notes: string | null; status: string;
};
const DEFAULT_SETTINGS: ReservationSettings = {
  capacity: 40, duration_minutes: 90, slot_interval_minutes: 30, buffer_minutes: 15,
  opening_hours: { "0": [], "1": [["12:00", "14:30"], ["19:00", "22:00"]], "2": [["12:00", "14:30"], ["19:00", "22:00"]], "3": [["12:00", "14:30"], ["19:00", "22:00"]], "4": [["12:00", "14:30"], ["19:00", "22:00"]], "5": [["12:00", "14:30"], ["19:00", "22:00"]], "6": [["12:00", "14:30"], ["19:00", "22:00"]] },
};

export default async function ReservationsPage() {
  const me = await getCurrentUser();
  const restaurantId = me?.memberships[0]?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};
  const restaurant = restaurantId ? await serverFetch<RestaurantInfo>("/restaurants/me", headers) : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: restaurant?.timezone ?? "UTC" }).format(new Date());
  const [reservations, settings, blocks] = restaurantId ? await Promise.all([
    serverFetch<Reservation[]>(`/reservations?date=${today}`, headers),
    serverFetch<ReservationSettings>("/reservations/settings", headers),
    serverFetch<ReservationBlock[]>("/reservations/blocks", headers),
  ]) : [null, null, null];

  return <div className="space-y-6">
    <PageHeader title="Reservations" description="Review bookings and manage availability for your restaurant." />
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Today’s bookings</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><th className="px-5 py-3">Time</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Guests</th><th className="px-5 py-3">Table</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-border">
            {(reservations ?? []).map((reservation) => <tr key={reservation.id}>
              <td className="whitespace-nowrap px-5 py-3">{new Date(reservation.reserved_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
              <td className="px-5 py-3"><div className="font-medium">{reservation.customer_name}</div><div className="text-xs text-muted-foreground">{reservation.customer_phone ?? reservation.customer_email ?? ""}</div></td>
              <td className="px-5 py-3">{reservation.guests}</td><td className="px-5 py-3">{reservation.table_label ?? "—"}</td>
              <td className="px-5 py-3 capitalize">{reservation.status.replaceAll("_", " ")}</td>
              <td className="px-5 py-3 text-right">{restaurantId && <ReservationActions reservationId={reservation.id} restaurantId={restaurantId} status={reservation.status} />}</td>
            </tr>)}
            {(!reservations || reservations.length === 0) && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No reservations for today.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
    {restaurantId && <ReservationSettingsEditor restaurantId={restaurantId} initial={settings ?? DEFAULT_SETTINGS} blocks={blocks ?? []} />}
  </div>;
}
