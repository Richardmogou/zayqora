"use client";

import { useState } from "react";
import { Search, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { currencySymbol } from "@/lib/currency-context";

export interface CustomerSummary {
  key: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  orders_count: number;
  reservations_count: number;
  total_spent_minor: number;
  last_activity_at: string;
  segment: "new" | "repeat";
}

export interface CustomerListResponse {
  total_customers: number;
  repeat_customers: number;
  new_customers: number;
  total_revenue_minor: number;
  customers: CustomerSummary[];
}

export function CustomersView({
  initialData,
  currency,
}: {
  initialData: CustomerListResponse;
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "repeat" | "new">("all");
  const sym = currencySymbol(currency);

  const query = search.trim().toLowerCase();
  const filtered = initialData.customers.filter((c) => {
    return (
      (segmentFilter === "all" || c.segment === segmentFilter) &&
      (!query ||
        c.customer_name.toLowerCase().includes(query) ||
        (c.customer_email ?? "").toLowerCase().includes(query) ||
        (c.customer_phone ?? "").toLowerCase().includes(query))
    );
  });

  const kpis = [
    {
      label: "Total customers",
      value: String(initialData.total_customers),
      icon: Users,
      bg: "bg-[#EAF4EE] border-[#D3E7DC]",
    },
    {
      label: "Repeat customers",
      value: String(initialData.repeat_customers),
      icon: UserCheck,
      bg: "bg-[#FBF5E8] border-[#EFE2C6]",
    },
    {
      label: "New customers",
      value: String(initialData.new_customers),
      icon: UserPlus,
      bg: "bg-[#EBF3FA] border-[#D4E4F4]",
    },
    {
      label: "Customer revenue",
      value: `${sym}${(initialData.total_revenue_minor / 100).toFixed(2)}`,
      icon: Wallet,
      bg: "bg-[#F3EFFA] border-[#E2D6F5]",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers (CRM)"
        description="Track guest order and reservation history, spend summaries and repeat segments"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-5 text-[#0B2A22] ${kpi.bg}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">{kpi.label}</p>
              <kpi.icon className="h-4 w-4 text-[#0B2A22]/70" />
            </div>
            <p className="mt-2.5 text-2xl font-extrabold sm:text-3xl">{kpi.value}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customer, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none sm:w-64"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All customers"],
                ["repeat", "Repeat guests"],
                ["new", "New guests"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSegmentFilter(key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  segmentFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Segment</th>
                <th className="px-6 py-4 text-center">Orders</th>
                <th className="px-6 py-4 text-center">Bookings</th>
                <th className="px-6 py-4">Total spent</th>
                <th className="px-6 py-4 text-right">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No customers match your search.
                  </td>
                </tr>
              )}
              {filtered.map((customer) => (
                <tr key={customer.key} className="hover:bg-muted/20">
                  <td className="px-6 py-4 font-semibold text-primary">{customer.customer_name}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    <div>{customer.customer_email ?? "—"}</div>
                    <div>{customer.customer_phone ?? ""}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={customer.segment === "repeat" ? "success" : "info"}>
                      {customer.segment === "repeat" ? "Repeat" : "New"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{customer.orders_count}</td>
                  <td className="px-6 py-4 text-center font-medium">{customer.reservations_count}</td>
                  <td className="px-6 py-4 font-semibold">
                    {sym}
                    {(customer.total_spent_minor / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                    {new Date(customer.last_activity_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
