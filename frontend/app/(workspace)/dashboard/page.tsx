import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar, ChevronRight, Receipt, Star, TrendingUp, Users, Utensils } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { getL } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, Tone> = { active: "success", pending: "warning", suspended: "danger" };
const ORDER_TONE: Record<string, Tone> = {
  received: "info",
  confirmed: "info",
  in_preparation: "warning",
  ready: "success",
  served: "success",
  cancelled: "danger",
};

interface OrderRow {
  id: string;
  customer_name: string;
  service_mode: string;
  total_minor: number;
  status: string;
  created_at: string;
}

interface ReservationRow {
  id: string;
  customer_name: string;
  guests: number;
  table_label: string | null;
  reserved_at: string;
  status: string;
}

interface MenuItemRow {
  id: string;
  name: string;
  is_available: boolean;
  is_published: boolean;
}

export default async function DashboardPage() {
  const L = getL();
  const me = await getCurrentUser();
  if (me?.user.is_platform_admin && (!me.memberships || me.memberships.length === 0)) {
    redirect("/platform");
  }
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const restaurant = restaurantId
    ? await serverFetch<RestaurantInfo>("/restaurants/me", headers)
    : null;
  const tz = restaurant?.timezone ?? "UTC";
  const sym = currencySymbol(restaurant?.currency ?? "EUR");
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const todayDisplay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(new Date());

  const [orders, reservations, menuItems] = restaurantId
    ? await Promise.all([
        serverFetch<OrderRow[]>("/orders", headers),
        serverFetch<ReservationRow[]>(`/reservations?date=${todayIso}`, headers),
        serverFetch<MenuItemRow[]>("/menu/items", headers),
      ])
    : [[], [], []];

  const allOrders = orders ?? [];
  const validOrders = allOrders.filter((o) => o.status !== "cancelled");
  const grossSalesMinor = validOrders.reduce((acc, o) => acc + o.total_minor, 0);
  const avgTicketMinor = validOrders.length > 0 ? Math.round(grossSalesMinor / validOrders.length) : 0;

  const todayReservations = reservations ?? [];
  const activeCovers = todayReservations
    .filter((r) => ["pending", "confirmed", "seated", "completed"].includes(r.status))
    .reduce((acc, r) => acc + r.guests, 0);

  const items = menuItems ?? [];
  const publishedItems = items.filter((i) => i.is_published);
  const unavailableItems = items.filter((i) => !i.is_available);

  const kpis = [
    {
      label: L("Active orders", "Commandes actives"),
      value: String(validOrders.length),
      trend: `${sym}${(grossSalesMinor / 100).toFixed(2)} ${L("gross sales", "CA brut")}`,
      icon: Utensils,
      bg: "bg-[#EAF4EE] border-[#D3E7DC] text-[#0B2A22]",
      iconBg: "bg-[#D2EADF] text-[#1D6846]",
    },
    {
      label: L("Covers booked today", "Couverts réservés"),
      value: String(activeCovers),
      trend: `${todayReservations.length} ${L("bookings today", "réservations")}`,
      icon: Users,
      bg: "bg-[#FBF5E8] border-[#EFE2C6] text-[#0B2A22]",
      iconBg: "bg-[#F3E2BA] text-[#9B6B15]",
    },
    {
      label: L("Average ticket", "Panier moyen"),
      value: `${sym}${(avgTicketMinor / 100).toFixed(2)}`,
      trend: L("Server-verified total", "Calculé côté serveur"),
      icon: Receipt,
      bg: "bg-[#EBF3FA] border-[#D4E4F4] text-[#0B2A22]",
      iconBg: "bg-[#D1E4F7] text-[#245E9C]",
    },
    {
      label: L("Published dishes", "Plats publiés"),
      value: `${publishedItems.length}/${items.length}`,
      trend: `${unavailableItems.length} ${L("unavailable", "indisponible(s)")}`,
      icon: Star,
      bg: "bg-[#F7F6F1] border-[#E6E2D8] text-[#0B2A22]",
      iconBg: "bg-[#E9DDF8] text-[#6B42A6]",
    },
  ];

  const alerts: { title: string; subtitle: string; dot: string; href: string }[] = [];
  for (const item of unavailableItems.slice(0, 2)) {
    alerts.push({
      title: L("Out of stock", "Rupture de stock"),
      subtitle: item.name,
      dot: "bg-[#D9534F]",
      href: "/menu",
    });
  }
  const pendingResCount = todayReservations.filter((r) => r.status === "pending").length;
  if (pendingResCount > 0) {
    alerts.push({
      title: L("Pending reservations", "Réservations à confirmer"),
      subtitle: `${pendingResCount} ${L("awaiting confirmation", "en attente")}`,
      dot: "bg-[#2F80ED]",
      href: "/reservations",
    });
  }
  const activeKitchenCount = allOrders.filter((o) => ["received", "confirmed", "in_preparation"].includes(o.status)).length;
  if (activeKitchenCount > 0) {
    alerts.push({
      title: L("Active kitchen tickets", "Tickets en cuisine"),
      subtitle: `${activeKitchenCount} ${L("in queue", "en cours")}`,
      dot: "bg-[#E69924]",
      href: "/kitchen",
    });
  }
  if (restaurant?.status !== "active") {
    alerts.push({
      title: L("Storefront in draft", "Vitrine en brouillon"),
      subtitle: L("Publish from Settings", "Publiez depuis Paramètres"),
      dot: "bg-[#E69924]",
      href: "/settings",
    });
  }

  const pendingOrders = allOrders.slice(0, 5).map((order) => ({
    id: `#${order.id.slice(0, 8).toUpperCase()}`,
    rawId: order.id,
    customer: order.customer_name,
    time: new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
    status: order.status.replaceAll("_", " "),
    tone: ORDER_TONE[order.status] ?? "neutral",
  }));

  const upcomingReservations = todayReservations.slice(0, 5).map((res) => ({
    id: res.id,
    time: new Date(res.reserved_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
    customer: res.customer_name,
    guests: res.guests,
    table: res.table_label ?? L("Unassigned", "Non assignée"),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title={L("Overview", "Vue d'ensemble")}
          description={L(
            `Welcome to your ZAYQORA restaurant workspace${restaurant ? ` — ${restaurant.name}` : ""}`,
            `Bienvenue sur votre espace restaurant ZAYQORA${restaurant ? ` — ${restaurant.name}` : ""}`
          )}
        />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium">
            <Calendar className="h-4 w-4" /> {todayDisplay}
          </span>
          <Badge tone={STATUS_TONE[restaurant?.status ?? "active"] ?? "success"}>
            {restaurant?.status === "active"
              ? L("Storefront published", "Vitrine publiée")
              : L("Draft mode", "Mode brouillon")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="relative overflow-hidden rounded-2xl shadow-sm">
            <img
              src="/images/p1-banner-native.png"
              alt="ZAYQORA signature dish"
              className="h-48 w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col justify-center p-8">
              <p className="font-serif text-4xl tracking-[0.06em] text-white">ZAYQORA</p>
              <p className="mt-2 max-w-xs text-xs font-bold uppercase leading-relaxed tracking-[0.12em] text-white/95">
                {L("A CULINARY EXPERIENCE", "UNE EXPÉRIENCE CULINAIRE")}
                <br />
                {L("THAT BRINGS PEOPLE TOGETHER", "QUI RASSEMBLE")}
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">{L("Today's activity", "Activité du jour")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className={`rounded-2xl border p-4 shadow-sm ${kpi.bg}`}>
                  <span className={`inline-grid h-9 w-9 place-items-center rounded-full ${kpi.iconBg}`}>
                    <kpi.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-2.5 text-xs font-medium text-[#42524C]">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{kpi.value}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#1D6846]">
                    <TrendingUp className="h-3 w-3" /> {kpi.trend}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="h-full rounded-2xl border border-[#F2D6D2] bg-[#FAF0EE] p-6 text-[#0B2A22]">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full bg-[#D9534F]" />
              <h2 className="text-lg font-bold text-[#B4322A]">{L("Alerts", "Alertes")}</h2>
            </div>

            <div className="mt-4 divide-y divide-[#EED4D0]">
              {alerts.map((alert) => (
                <Link
                  key={alert.title}
                  href={alert.href}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${alert.dot}`} />
                    <div>
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="text-xs text-[#42524C]">{alert.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Card title={L("Pending orders", "Commandes en attente")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2.5 font-medium">{L("Order #", "N° commande")}</th>
                    <th className="pb-2.5 font-medium">{L("Customer", "Client")}</th>
                    <th className="pb-2.5 font-medium">{L("Time", "Heure")}</th>
                    <th className="pb-2.5 font-medium">{L("Status", "Statut")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {pendingOrders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                        {L("No orders yet.", "Aucune commande pour le moment.")}
                      </td>
                    </tr>
                  )}
                  {pendingOrders.map((order) => (
                    <tr key={order.rawId}>
                      <td className="py-2.5 font-semibold">
                        <Link href={`/orders/${order.rawId}`} className="text-primary hover:underline">
                          {order.id}
                        </Link>
                      </td>
                      <td className="py-2.5">{order.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{order.time}</td>
                      <td className="py-2.5 capitalize">
                        <Badge tone={order.tone}>{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {L("View all", "Voir tout")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-6">
          <Card title={L("Upcoming reservations", "Réservations à venir")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2.5 font-medium">{L("Time", "Heure")}</th>
                    <th className="pb-2.5 font-medium">{L("Customer", "Client")}</th>
                    <th className="pb-2.5 font-medium">{L("Guests", "Couverts")}</th>
                    <th className="pb-2.5 font-medium">{L("Table", "Table")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {upcomingReservations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                        {L("No reservations scheduled for today.", "Aucune réservation prévue aujourd'hui.")}
                      </td>
                    </tr>
                  )}
                  {upcomingReservations.map((res) => (
                    <tr key={res.id}>
                      <td className="py-2.5 font-medium">{res.time}</td>
                      <td className="py-2.5">{res.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{res.guests}</td>
                      <td className="py-2.5 font-medium">{res.table}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <Link href="/reservations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {L("View all", "Voir tout")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
