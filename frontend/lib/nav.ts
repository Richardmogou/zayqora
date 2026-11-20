import { BarChart3, Bell, Bike, Boxes, Calculator, CalendarCheck, ChefHat, LayoutDashboard, QrCode, Settings, ShoppingBag, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/pos", key: "nav.pos", icon: Calculator },
  { href: "/menu", key: "nav.menu", icon: UtensilsCrossed },
  { href: "/orders", key: "nav.orders", icon: ShoppingBag },
  { href: "/kitchen", key: "nav.kitchen", icon: ChefHat },
  { href: "/tables", key: "nav.tables", icon: QrCode },
  { href: "/reservations", key: "nav.reservations", icon: CalendarCheck },
  { href: "/deliveries", key: "nav.deliveries", icon: Bike },
  { href: "/inventory", key: "nav.inventory", icon: Boxes },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/customers", key: "nav.customers", icon: Users },
  { href: "/reports", key: "nav.reports", icon: BarChart3 },
  { href: "/settings", key: "nav.settings", icon: Settings },
];
