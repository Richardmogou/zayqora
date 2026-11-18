"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface OrderListItem {
  id: string;
  customer_name: string;
  service_mode: string;
  table_label: string | null;
  payment_method: string;
  total_minor: number;
  status: string;
  created_at: string;
}

const STATUS_TONE: Record<string, Tone> = {
  received: "info",
  confirmed: "info",
  in_preparation: "warning",
  ready: "success",
  served: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  confirmed: "Confirmed",
  in_preparation: "In preparation",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export function OrdersTable({ orders, sym }: { orders: OrderListItem[]; sym: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  const query = search.trim().toLowerCase();
  const filtered = orders.filter((order) => {
    const shortId = order.id.slice(0, 8).toLowerCase();
    return (
      (!query || order.customer_name.toLowerCase().includes(query) || shortId.includes(query)) &&
      (statusFilter === "ALL" || order.status === statusFilter) &&
      (modeFilter === "ALL" || order.service_mode === modeFilter) &&
      (paymentFilter === "ALL" || order.payment_method === paymentFilter)
    );
  });

  const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none sm:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="ALL">All statuses</option>
            <option value="received">Received</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_preparation">In preparation</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={selectClass}>
            <option value="ALL">All service modes</option>
            <option value="dine-in">Dine-in</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={selectClass}>
            <option value="ALL">All payments</option>
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              <th className="px-6 py-4">No.</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Payment</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            )}
            {filtered.map((order) => {
              const tone = STATUS_TONE[order.status] ?? "neutral";
              const time = new Date(order.created_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={order.id} className="hover:bg-muted/20">
                  <td className="px-6 py-4 font-semibold text-primary">#{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-6 py-4 text-muted-foreground">{time}</td>
                  <td className="px-6 py-4 font-medium">{order.customer_name}</td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{order.service_mode}</td>
                  <td className="px-6 py-4 font-semibold">
                    {sym}
                    {(order.total_minor / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{order.payment_method}</td>
                  <td className="px-6 py-4">
                    <Badge tone={tone}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      Open <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
