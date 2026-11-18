"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

const NEXT: Record<string, { status: string; label: string }[]> = {
  received: [{ status: "confirmed", label: "Confirm order" }, { status: "in_preparation", label: "Start preparing" }],
  confirmed: [{ status: "in_preparation", label: "Start preparing" }],
  in_preparation: [{ status: "ready", label: "Mark as ready" }],
  ready: [{ status: "served", label: "Mark as served" }],
};

export default function OrderStatusActions({ orderId, restaurantId, currentStatus, role }: {
  orderId: string; restaurantId: string; currentStatus: string; role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const actions = (NEXT[currentStatus] ?? []).filter((action) => role !== "kitchen" || ["in_preparation", "ready"].includes(action.status));
  const canCancel = role !== "kitchen" && ["received", "confirmed", "in_preparation", "ready"].includes(currentStatus);

  async function updateStatus(status: string) {
    setLoading(true); setError("");
    try {
      await api(`/orders/${orderId}/status`, { method: "PATCH", headers: { "X-Restaurant-Id": restaurantId }, body: JSON.stringify({ status }) });
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update order status."); }
    finally { setLoading(false); }
  }

  if (!actions.length && !canCancel) return null;
  return <Card title="Actions">
    <div className="space-y-3">
      {actions.map((action) => <button key={action.status} type="button" disabled={loading} onClick={() => void updateStatus(action.status)} className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">{action.label}</button>)}
      {canCancel && <button type="button" disabled={loading} onClick={() => void updateStatus("cancelled")} className="h-11 w-full rounded-xl bg-danger/15 text-sm font-semibold text-danger transition hover:bg-danger/25 disabled:opacity-60">Cancel order</button>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  </Card>;
}
