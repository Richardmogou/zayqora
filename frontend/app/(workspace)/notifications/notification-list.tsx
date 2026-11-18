"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export type NotificationItem = {
  id: string; event_type: string; title: string; body: string; entity_type: string | null;
  entity_id: string | null; read_at: string | null; created_at: string;
};

export function NotificationList({ restaurantId, initial }: { restaurantId: string; initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState("");
  async function markRead(id: string) {
    setError("");
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH", headers: { "X-Restaurant-Id": restaurantId } });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not mark notification as read."); }
  }
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!items.length && <Card><p className="py-8 text-center text-muted-foreground">You’re all caught up.</p></Card>}
    {items.map((item) => <Card key={item.id} className={item.read_at ? "opacity-70" : "border-l-4 border-l-primary"}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>
        {!item.read_at && <button onClick={() => void markRead(item.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Mark read</button>}
      </div>
    </Card>)}
  </div>;
}
