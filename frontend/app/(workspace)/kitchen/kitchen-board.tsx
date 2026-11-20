"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Columns3, GripVertical, LayoutGrid, Plus, Radio } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export type KitchenStationItem = {
  id: string;
  name: string;
  code: string;
};

export type KitchenOrder = {
  id: string;
  customer_name: string;
  service_mode: string;
  table_label: string | null;
  status: string;
  created_at: string;
  special_instructions: string | null;
  stations?: string[];
  lines: {
    id: string;
    name: string;
    quantity: number;
    kitchen_station?: string | null;
    modifiers_snapshot: { name: string }[] | null;
  }[];
};

const KITCHEN_COLUMNS: { status: string; label: string; tone: Tone }[] = [
  { status: "received", label: "Received", tone: "info" },
  { status: "confirmed", label: "Confirmed", tone: "info" },
  { status: "in_preparation", label: "In preparation", tone: "warning" },
  { status: "ready", label: "Ready · Bump", tone: "success" },
];

const KITCHEN_TRANSITIONS: Record<string, string[]> = {
  received: ["confirmed", "in_preparation"],
  confirmed: ["in_preparation"],
  in_preparation: ["ready"],
};

const EDITOR_ROLES = new Set(["owner", "manager", "cashier", "kitchen"]);

function canMoveTicket(from: string, to: string, role: string): boolean {
  if (!EDITOR_ROLES.has(role)) return false;
  if (role === "kitchen" && to !== "in_preparation" && to !== "ready") return false;
  return (KITCHEN_TRANSITIONS[from] ?? []).includes(to);
}

export function KitchenBoard({
  restaurantId,
  role = "kitchen",
  initial,
  initialStations = [],
}: {
  restaurantId: string;
  role?: string;
  initial: KitchenOrder[];
  initialStations?: KitchenStationItem[];
}) {
  const [orders, setOrders] = useState(initial);
  const [stations, setStations] = useState<KitchenStationItem[]>(initialStations);
  const [stationFilter, setStationFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"kanban" | "grid">("kanban");
  const [liveConnected, setLiveConnected] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [newStationName, setNewStationName] = useState("");
  const [addingStation, setAddingStation] = useState(false);

  const canManageStations = role === "owner" || role === "manager";

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (stationFilter !== "ALL") params.set("station", stationFilter);
      if (modeFilter !== "ALL") params.set("service_mode", modeFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      setOrders(
        await api<KitchenOrder[]>(`/kitchen/tickets${qs}`, {
          headers: { "X-Restaurant-Id": restaurantId },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh kitchen orders.");
    }
  }, [modeFilter, restaurantId, stationFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base = process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000`;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(`${base}/api/v1/ws/restaurant?restaurant_id=${encodeURIComponent(restaurantId)}`);
      socket.onopen = () => setLiveConnected(true);
      socket.onclose = () => setLiveConnected(false);
      socket.onerror = () => setLiveConnected(false);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { event?: string };
          if (msg.event && msg.event !== "connected") {
            void refresh();
          }
        } catch {}
      };
    } catch {
      setLiveConnected(false);
    }
    return () => {
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    };
  }, [refresh, restaurantId]);

  async function update(orderId: string, status: string) {
    setBusyId(orderId);
    setError("");
    try {
      await api(`/kitchen/tickets/${orderId}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      setBusyId("");
    }
  }

  async function handleAddStation(e: FormEvent) {
    e.preventDefault();
    if (!canManageStations || !newStationName.trim()) return;
    setAddingStation(true);
    setError("");
    try {
      const created = await api<KitchenStationItem>("/kitchen/stations", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          name: newStationName.trim(),
          code: newStationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        }),
      });
      setStations((prev) => [...prev, created]);
      setNewStationName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add kitchen station.");
    } finally {
      setAddingStation(false);
    }
  }

  const discoveredStations = Array.from(
    new Set([
      ...stations.map((s) => s.name),
      ...orders.flatMap((o) => o.stations ?? []),
    ])
  ).sort();

  const draggedOrder = draggedId ? orders.find((order) => order.id === draggedId) ?? null : null;

  function renderTicket(order: KitchenOrder, draggable: boolean) {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
    const allergy = /allerg|allergie/i.test(order.special_instructions ?? "");
    const targetStatus = order.status === "in_preparation" ? "ready" : "in_preparation";
    const canAction = canMoveTicket(order.status, targetStatus, role);
    const canDrag =
      draggable &&
      busyId !== order.id &&
      KITCHEN_COLUMNS.some((column) => canMoveTicket(order.status, column.status, role));

    return (
      <div
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
        className={`${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${busyId === order.id || draggedId === order.id ? "opacity-50" : ""}`}
      >
        <Card className="border-t-4 border-t-primary">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                {canDrag && <GripVertical className="h-4 w-4 text-muted-foreground" />}
                <p className="text-xl font-bold text-primary">#{order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <p className="mt-1 text-sm font-semibold">{order.customer_name}</p>
            </div>
            <div className="text-right">
              <p className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">
                {order.service_mode}{order.table_label ? ` · ${order.table_label}` : ""}
              </p>
              <p className={`mt-2 text-xs font-semibold ${elapsedMinutes >= 20 ? "text-danger" : "text-muted-foreground"}`}>
                {elapsedMinutes} min ago
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 border-y border-border py-4">
            {order.lines.map((line) => (
              <li key={line.id} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 font-bold text-primary">{line.quantity}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{line.name}</p>
                    {line.kitchen_station && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {line.kitchen_station}
                      </span>
                    )}
                  </div>
                  {line.modifiers_snapshot?.length ? (
                    <p className="text-xs text-muted-foreground">{line.modifiers_snapshot.map((modifier) => modifier.name).join(", ")}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {order.special_instructions && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${allergy ? "bg-danger/10 font-semibold text-danger" : "bg-muted/50 text-muted-foreground"}`}>
              {allergy ? "⚠ " : ""}{order.special_instructions}
            </p>
          )}
          {canAction && (
            <button
              type="button"
              disabled={busyId === order.id}
              onClick={() => void update(order.id, targetStatus)}
              className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busyId === order.id ? "Saving…" : targetStatus === "ready" ? "Mark ticket ready" : "Start preparing"}
            </button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${liveConnected ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            <Radio className="h-3.5 w-3.5" /> {liveConnected ? "Live WS" : "Polling 15s"}
          </span>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">All stations</option>
            {discoveredStations.map((station) => (
              <option key={station} value={station}>{station}</option>
            ))}
          </select>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">All service modes</option>
            <option value="dine-in">Dine-in</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageStations && (
            <form onSubmit={handleAddStation} className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Add station (Grill, Bar…)"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                className="h-9 w-44 rounded-lg border border-border bg-card px-2.5 text-xs focus:outline-none"
              />
              <button
                type="submit"
                disabled={addingStation || !newStationName.trim()}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Station
              </button>
            </form>
          )}
          <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${
                viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
          <button onClick={() => void refresh()} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
            Refresh
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {orders.length === 0 ? (
        <Card><p className="py-8 text-center text-muted-foreground">No active kitchen tickets.</p></Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {orders.map((order) => renderTicket(order, false))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {KITCHEN_COLUMNS.map((column) => {
            const columnOrders = orders.filter((order) => order.status === column.status);
            const isValidTarget = draggedOrder !== null && canMoveTicket(draggedOrder.status, column.status, role);
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
                  const targetOrder = orders.find((item) => item.id === orderId);
                  if (!targetOrder || !canMoveTicket(targetOrder.status, column.status, role)) return;
                  void update(orderId, column.status);
                }}
                className={`flex min-h-[26rem] flex-col rounded-xl border p-3 transition ${
                  isHovered
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : isValidTarget
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/25"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <Badge tone={column.tone}>{column.label}</Badge>
                  {column.status !== "ready" && (
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {columnOrders.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  {column.status === "ready" ? (
                    <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border/80 px-4 text-center text-xs text-muted-foreground">
                      {isValidTarget ? "Drop ticket to mark ready" : "Drag an in-preparation ticket here to bump it ready"}
                    </div>
                  ) : columnOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                      {isValidTarget ? "Drop ticket here" : "No tickets"}
                    </div>
                  ) : (
                    columnOrders.map((order) => renderTicket(order, true))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
