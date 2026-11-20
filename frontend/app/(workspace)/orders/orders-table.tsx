"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Columns3, GripVertical, List, Search } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

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
  out_for_delivery: "warning",
  served: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  confirmed: "Confirmed",
  in_preparation: "In preparation",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  served: "Served",
  cancelled: "Cancelled",
};

const ORDER_COLUMNS: { status: string; label: string; tone: Tone }[] = [
  { status: "received", label: "Received", tone: "info" },
  { status: "confirmed", label: "Confirmed", tone: "info" },
  { status: "in_preparation", label: "In preparation", tone: "warning" },
  { status: "ready", label: "Ready", tone: "success" },
  { status: "out_for_delivery", label: "Out for delivery", tone: "warning" },
  { status: "served", label: "Served", tone: "success" },
  { status: "cancelled", label: "Cancelled", tone: "danger" },
];

const ORDER_TRANSITIONS: Record<string, string[]> = {
  received: ["confirmed", "in_preparation", "cancelled"],
  confirmed: ["in_preparation", "cancelled"],
  in_preparation: ["ready", "cancelled"],
  ready: ["out_for_delivery", "served", "cancelled"],
  out_for_delivery: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

const STATUS_EDITOR_ROLES = new Set(["owner", "manager", "cashier", "kitchen"]);

const PRIMARY_NEXT: Record<string, { status: string; label: string }> = {
  received: { status: "confirmed", label: "Confirm" },
  confirmed: { status: "in_preparation", label: "Start preparing" },
  in_preparation: { status: "ready", label: "Mark ready" },
  ready: { status: "served", label: "Mark served" },
  out_for_delivery: { status: "served", label: "Mark delivered" },
};

function canMoveOrder(from: string, to: string, role: string, hasRestaurant: boolean): boolean {
  if (!hasRestaurant || !STATUS_EDITOR_ROLES.has(role)) return false;
  if (role === "kitchen" && to !== "in_preparation" && to !== "ready") return false;
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export function OrdersTable({
  orders,
  sym,
  restaurantId = null,
  role = "owner",
}: {
  orders: OrderListItem[];
  sym: string;
  restaurantId?: string | null;
  role?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<OrderListItem[]>(orders);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  useEffect(() => {
    setItems(orders);
  }, [orders]);

  const query = search.trim().toLowerCase();
  const filtered = items.filter((order) => {
    const shortId = order.id.slice(0, 8).toLowerCase();
    return (
      (!query || order.customer_name.toLowerCase().includes(query) || shortId.includes(query)) &&
      (statusFilter === "ALL" || order.status === statusFilter) &&
      (modeFilter === "ALL" || order.service_mode === modeFilter) &&
      (paymentFilter === "ALL" || order.payment_method === paymentFilter)
    );
  });

  const draggedOrder = draggedId ? items.find((item) => item.id === draggedId) ?? null : null;
  const visibleColumns =
    statusFilter === "ALL" ? ORDER_COLUMNS : ORDER_COLUMNS.filter((column) => column.status === statusFilter);

  async function updateOrderStatus(orderId: string, nextStatus: string) {
    if (!restaurantId) return;
    setBusyId(orderId);
    setError("");
    try {
      await api(`/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ status: nextStatus }),
      });
      setItems((prev) => prev.map((item) => (item.id === orderId ? { ...item, status: nextStatus } : item)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order status.");
    } finally {
      setBusyId(null);
    }
  }

  function primaryActionFor(order: OrderListItem) {
    if (role === "kitchen" && (order.status === "received" || order.status === "confirmed")) {
      return { status: "in_preparation", label: "Start preparing" };
    }
    const candidate = PRIMARY_NEXT[order.status];
    if (!candidate) return null;
    return canMoveOrder(order.status, candidate.status, role, Boolean(restaurantId)) ? candidate : null;
  }

  const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
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

        <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" /> Kanban
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {visibleColumns.map((column) => {
            const columnOrders = filtered.filter((order) => order.status === column.status);
            const isValidTarget =
              draggedOrder !== null && canMoveOrder(draggedOrder.status, column.status, role, Boolean(restaurantId));
            const isHovered = dragOverStatus === column.status && isValidTarget;
            return (
              <section
                key={column.status}
                onDragOver={(e) => {
                  if (!isValidTarget) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStatus(column.status);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverStatus === column.status) setDragOverStatus(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const orderId = e.dataTransfer.getData("text/plain") || draggedId;
                  setDraggedId(null);
                  setDragOverStatus(null);
                  if (!orderId) return;
                  const targetOrder = items.find((item) => item.id === orderId);
                  if (!targetOrder || !canMoveOrder(targetOrder.status, column.status, role, Boolean(restaurantId))) {
                    return;
                  }
                  void updateOrderStatus(orderId, column.status);
                }}
                className={`flex min-h-[24rem] w-72 shrink-0 flex-col rounded-xl border p-3 transition ${
                  isHovered
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : isValidTarget
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/25"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <Badge tone={column.tone}>{column.label}</Badge>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5">
                  {columnOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                      {isValidTarget ? "Drop order here" : "No orders"}
                    </div>
                  ) : (
                    columnOrders.map((order) => {
                      const canDrag =
                        busyId !== order.id &&
                        ORDER_COLUMNS.some((target) =>
                          canMoveOrder(order.status, target.status, role, Boolean(restaurantId))
                        );
                      const nextAction = primaryActionFor(order);
                      const time = new Date(order.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <article
                          key={order.id}
                          draggable={canDrag}
                          onDragStart={(e) => {
                            if (!canDrag) return;
                            e.dataTransfer.setData("text/plain", order.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedId(order.id);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragOverStatus(null);
                          }}
                          className={`rounded-xl border border-border bg-card p-3.5 shadow-sm transition ${
                            canDrag ? "cursor-grab active:cursor-grabbing hover:border-primary/40" : ""
                          } ${busyId === order.id || draggedId === order.id ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {canDrag && <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-sm font-bold text-primary">#{order.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{time}</span>
                          </div>

                          <p className="mt-1.5 text-sm font-semibold">{order.customer_name}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="capitalize">
                              {order.service_mode}
                              {order.table_label ? ` · ${order.table_label}` : ""}
                            </span>
                            <span className="font-semibold text-foreground">
                              {sym}
                              {(order.total_minor / 100).toFixed(2)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                            {nextAction ? (
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={() => void updateOrderStatus(order.id, nextAction.status)}
                                className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                              >
                                {busyId === order.id ? "Saving…" : nextAction.label}
                              </button>
                            ) : (
                              <span className="text-xs capitalize text-muted-foreground">{order.payment_method}</span>
                            )}
                            <Link
                              href={`/orders/${order.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              Open <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
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
      )}
    </div>
  );
}
