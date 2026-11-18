"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

type KitchenOrder = {
  id: string; customer_name: string; service_mode: string; table_label: string | null; status: string;
  created_at: string; special_instructions: string | null;
  lines: { id: string; name: string; quantity: number; modifiers_snapshot: { name: string }[] | null }[];
};

export function KitchenBoard({ restaurantId, initial }: { restaurantId: string; initial: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { setOrders(await api<KitchenOrder[]>("/orders/kitchen", { headers: { "X-Restaurant-Id": restaurantId } })); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not refresh kitchen orders."); }
  }, [restaurantId]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function update(orderId: string, status: string) {
    setBusyId(orderId); setError("");
    try {
      await api(`/orders/${orderId}/status`, { method: "PATCH", headers: { "X-Restaurant-Id": restaurantId }, body: JSON.stringify({ status }) });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update order."); }
    finally { setBusyId(""); }
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Refreshes automatically every 15 seconds.</p><button onClick={() => void refresh()} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Refresh</button></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {orders.length === 0 ? <Card><p className="py-8 text-center text-muted-foreground">No active kitchen tickets.</p></Card> :
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {orders.map((order) => {
          const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
          const allergy = /allerg|allergie/i.test(order.special_instructions ?? "");
          const targetStatus = order.status === "in_preparation" ? "ready" : "in_preparation";
          return <Card key={order.id} className="border-t-4 border-t-primary">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xl font-bold text-primary">#{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{order.customer_name}</p></div>
              <div className="text-right"><p className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{order.service_mode}{order.table_label ? ` · ${order.table_label}` : ""}</p><p className={`mt-2 text-xs font-semibold ${elapsedMinutes >= 20 ? "text-danger" : "text-muted-foreground"}`}>{elapsedMinutes} min ago</p></div>
            </div>
            <ul className="mt-4 space-y-3 border-y border-border py-4">
              {order.lines.map((line) => <li key={line.id} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 font-bold text-primary">{line.quantity}</span><div><p className="font-semibold">{line.name}</p>{line.modifiers_snapshot?.length ? <p className="text-xs text-muted-foreground">{line.modifiers_snapshot.map((modifier) => modifier.name).join(", ")}</p> : null}</div></li>)}
            </ul>
            {order.special_instructions && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${allergy ? "bg-danger/10 font-semibold text-danger" : "bg-muted/50 text-muted-foreground"}`}>{allergy ? "⚠ " : ""}{order.special_instructions}</p>}
            <button type="button" disabled={busyId === order.id} onClick={() => void update(order.id, targetStatus)} className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busyId === order.id ? "Saving…" : targetStatus === "ready" ? "Mark ticket ready" : "Start preparing"}
            </button>
          </Card>;
        })}
      </div>}
  </div>;
}
