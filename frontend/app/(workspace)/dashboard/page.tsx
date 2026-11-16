import Link from "next/link";
import { ArrowRight, Calendar, ChevronRight, Receipt, Star, TrendingUp, Users, Utensils } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { getL } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, Tone> = { active: "success", pending: "warning", suspended: "danger" };

export default async function DashboardPage() {
  const L = getL();
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurant = membership
    ? await serverFetch<RestaurantInfo>("/restaurants/me", { "X-Restaurant-Id": membership.restaurant_id })
    : null;

  const kpis = [
    {
      label: L("Today's orders", "Commandes du jour"),
      value: "48",
      trend: L("+12% vs yesterday", "+12% vs hier"),
      icon: Utensils,
      bg: "bg-[#EAF4EE] border-[#D3E7DC] text-[#0B2A22]",
      iconBg: "bg-[#D2EADF] text-[#1D6846]",
    },
    {
      label: L("Covers served", "Couverts servis"),
      value: "142",
      trend: L("+15% vs yesterday", "+15% vs hier"),
      icon: Users,
      bg: "bg-[#FBF5E8] border-[#EFE2C6] text-[#0B2A22]",
      iconBg: "bg-[#F3E2BA] text-[#9B6B15]",
    },
    {
      label: L("Average ticket", "Panier moyen"),
      value: "€32.50",
      trend: L("+7% vs yesterday", "+7% vs hier"),
      icon: Receipt,
      bg: "bg-[#EBF3FA] border-[#D4E4F4] text-[#0B2A22]",
      iconBg: "bg-[#D1E4F7] text-[#245E9C]",
    },
    {
      label: L("Customer satisfaction", "Satisfaction clients"),
      value: "4.8/5",
      trend: L("+0.2 vs yesterday", "+0.2 vs hier"),
      icon: Star,
      bg: "bg-[#F7F6F1] border-[#E6E2D8] text-[#0B2A22]",
      iconBg: "bg-[#E9DDF8] text-[#6B42A6]",
    },
  ];

  const alerts = [
    {
      title: L("Out of stock", "Rupture de stock"),
      subtitle: L("Fresh salmon", "Saumon frais"),
      dot: "bg-[#D9534F]",
      href: "/menu",
    },
    {
      title: L("Delayed order", "Commande en retard"),
      subtitle: "Table 12 - 15 min",
      dot: "bg-[#E69924]",
      href: "/orders",
    },
    {
      title: L("Oven in maintenance", "Four en maintenance"),
      subtitle: L("Main oven", "Four principal"),
      dot: "bg-[#E69924]",
      href: "/settings",
    },
    {
      title: L("Modified reservation", "Réservation modifiée"),
      subtitle: "Table 6 - 20h30",
      dot: "bg-[#2F80ED]",
      href: "/reservations",
    },
  ];

  const pendingOrders: { id: string; customer: string; time: string; status: string; tone: Tone }[] = [
    { id: "#1048", customer: L("Anonymous guest", "Client anonyme"), time: "12:37", status: L("In preparation", "En préparation"), tone: "warning" },
    { id: "#1047", customer: "Léa Martin", time: "12:42", status: L("In kitchen", "En cuisine"), tone: "neutral" },
    { id: "#1046", customer: "Thomas Bernard", time: "12:45", status: L("In preparation", "En préparation"), tone: "warning" },
    { id: "#1045", customer: "Sophie Dubois", time: "12:52", status: L("In kitchen", "En cuisine"), tone: "neutral" },
    { id: "#1044", customer: "Lucas Petit", time: "12:58", status: L("Ready to serve", "À servir"), tone: "success" },
  ];

  const upcomingReservations = [
    { time: "19:00", customer: "Camille Durand", guests: 2, table: "Table 5" },
    { time: "19:30", customer: "Mathieu Lefèvre", guests: 4, table: "Table 7" },
    { time: "20:15", customer: "Élodie Martin", guests: 2, table: "Table 12" },
    { time: "20:30", customer: "Thomas Garcia", guests: 6, table: "Table 8" },
    { time: "21:00", customer: "Julie Robert", guests: 2, table: "Table 5" },
  ];

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
            <Calendar className="h-4 w-4" /> {L("Saturday, April 26, 2025", "Samedi 26 avril 2025")}
          </span>
          <Badge tone={STATUS_TONE[restaurant?.status ?? "active"] ?? "success"}>
            {L("Restaurant open", "Restaurant ouvert")}
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
                  {pendingOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-2.5 font-semibold">{order.id}</td>
                      <td className="py-2.5">{order.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{order.time}</td>
                      <td className="py-2.5">
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
                  {upcomingReservations.map((res) => (
                    <tr key={res.time + res.customer}>
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
