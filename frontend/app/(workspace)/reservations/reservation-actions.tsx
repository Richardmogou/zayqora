"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NEXT: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "confirmed", label: "Confirm" }, { status: "cancelled", label: "Cancel" }],
  confirmed: [{ status: "seated", label: "Seat" }, { status: "no_show", label: "No show" }, { status: "cancelled", label: "Cancel" }],
  seated: [{ status: "completed", label: "Complete" }, { status: "cancelled", label: "Cancel" }],
};

export function ReservationActions({ reservationId, restaurantId, status }: {
  reservationId: string; restaurantId: string; status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions = NEXT[status] ?? [];
  if (!actions.length) return <span className="text-xs text-muted-foreground">—</span>;

  async function update(next: string) {
    setBusy(true); setError("");
    try {
      await api(`/reservations/${reservationId}/status`, {
        method: "PATCH", headers: { "X-Restaurant-Id": restaurantId }, body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update reservation.");
    } finally { setBusy(false); }
  }

  return <div className="flex flex-wrap justify-end gap-1.5">
    {actions.map((action) => <button key={action.status} type="button" disabled={busy} onClick={() => update(action.status)}
      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
      {action.label}
    </button>)}
    {error && <span className="basis-full text-right text-xs text-danger">{error}</span>}
  </div>;
}
