"use client";

import { useState, type FormEvent } from "react";
import { Bike, CheckCircle2, MapPin, Phone } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export interface DeliveryAssignmentItem {
  id: string;
  order_id: string;
  rider_user_id: string;
  rider_name: string | null;
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string | null;
  order_status: string;
  total_minor: number;
  status: string;
  notes: string | null;
  assigned_at: string;
  picked_up_at: string | null;
  en_route_at: string | null;
  delivered_at: string | null;
}

export interface DeliveryOrderOption {
  id: string;
  customer_name: string;
  status: string;
  service_mode: string;
}

export interface RiderOption {
  user_id: string;
  full_name: string;
  role: string;
}

const DELIVERY_TONE: Record<string, Tone> = {
  assigned: "info",
  picked_up: "warning",
  en_route: "warning",
  delivered: "success",
  failed: "danger",
};

const NEXT_MILESTONE: Record<string, { status: "picked_up" | "en_route" | "delivered"; label: string }> = {
  assigned: { status: "picked_up", label: "Mark picked up" },
  picked_up: { status: "en_route", label: "Mark en route" },
  en_route: { status: "delivered", label: "Mark delivered" },
};

export function DeliveriesBoard({
  restaurantId,
  sym,
  role,
  initialAssignments,
  deliveryOrders,
  riders,
}: {
  restaurantId: string;
  sym: string;
  role: string;
  initialAssignments: DeliveryAssignmentItem[];
  deliveryOrders: DeliveryOrderOption[];
  riders: RiderOption[];
}) {
  const [assignments, setAssignments] = useState<DeliveryAssignmentItem[]>(initialAssignments);
  const [selectedOrderId, setSelectedOrderId] = useState(deliveryOrders[0]?.id ?? "");
  const [selectedRiderId, setSelectedRiderId] = useState(riders[0]?.user_id ?? "");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canAssign = role === "owner" || role === "manager" || role === "cashier";

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!canAssign || !selectedOrderId || !selectedRiderId) return;
    setBusyId("assign");
    setError("");
    try {
      const created = await api<DeliveryAssignmentItem>("/deliveries/assign", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          order_id: selectedOrderId,
          rider_user_id: selectedRiderId,
          notes: notes.trim() || null,
        }),
      });
      setAssignments((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign delivery.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvance(assignmentId: string, nextStatus: "picked_up" | "en_route" | "delivered" | "failed") {
    setBusyId(assignmentId);
    setError("");
    try {
      const updated = await api<DeliveryAssignmentItem>(`/deliveries/${assignmentId}/status`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ status: nextStatus }),
      });
      setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update delivery milestone.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {canAssign && (
        <Card title="Assign delivery order to rider">
          {deliveryOrders.length === 0 || riders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {deliveryOrders.length === 0
                ? "No open delivery orders available to dispatch."
                : "Invite a staff member (or rider) in Settings to assign deliveries."}
            </p>
          ) : (
            <form onSubmit={handleAssign} className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Delivery order</label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"
                >
                  {deliveryOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8).toUpperCase()} · {o.customer_name} ({o.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Rider</label>
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"
                >
                  {riders.map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.full_name} ({r.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Dispatch note</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Gate code, fragile…"
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busyId === "assign"}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Bike className="h-4 w-4" /> Assign rider
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {assignments.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted-foreground">No delivery assignments yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map((item) => {
            const next = NEXT_MILESTONE[item.status];
            return (
              <Card key={item.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-primary">Order #{item.order_id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm font-semibold">{item.customer_name}</p>
                  </div>
                  <Badge tone={DELIVERY_TONE[item.status] ?? "neutral"}>{item.status.replace("_", " ")}</Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {item.delivery_address && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{item.delivery_address}</span>
                    </p>
                  )}
                  {item.customer_phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{item.customer_phone}</span>
                    </p>
                  )}
                  <p>
                    Rider: <strong className="text-foreground">{item.rider_name ?? "Assigned"}</strong> · Total:{" "}
                    <strong className="text-foreground">{sym}{(item.total_minor / 100).toFixed(2)}</strong>
                  </p>
                  {item.notes && <p className="rounded-lg bg-muted/40 px-2.5 py-1.5">{item.notes}</p>}
                </div>

                {next ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void handleAdvance(item.id, next.status)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {next.label}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void handleAdvance(item.id, "failed")}
                      className="h-10 rounded-xl border border-danger/40 px-3 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Failed
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {item.delivered_at ? `Delivered at ${new Date(item.delivered_at).toLocaleTimeString()}` : "Closed"}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
