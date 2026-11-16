import { BarChart3, CalendarCheck, LayoutDashboard, Settings, ShoppingBag, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon };

// Menu du MVP. Les pages autres que le tableau de bord sont des écrans provisoires jusqu'à leur jour de livraison.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/menu", key: "nav.menu", icon: UtensilsCrossed },
  { href: "/orders", key: "nav.orders", icon: ShoppingBag },
  { href: "/reservations", key: "nav.reservations", icon: CalendarCheck },
  { href: "/customers", key: "nav.customers", icon: Users },
  { href: "/reports", key: "nav.reports", icon: BarChart3 },
  { href: "/settings", key: "nav.settings", icon: Settings },
];
