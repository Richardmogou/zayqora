"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export type ReservationSettings = {
  capacity: number; duration_minutes: number; slot_interval_minutes: number; buffer_minutes: number;
  opening_hours: Record<string, [string, string][]>;
};
export type ReservationBlock = { id: string; starts_at: string; ends_at: string; reason: string | null };

export function ReservationSettingsEditor({ restaurantId, initial, blocks }: {
  restaurantId: string; initial: ReservationSettings; blocks: ReservationBlock[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [hours, setHours] = useState(JSON.stringify(initial.opening_hours, null, 2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const opening_hours = JSON.parse(hours) as ReservationSettings["opening_hours"];
      const next = await api<ReservationSettings>("/reservations/settings", {
        method: "PUT", headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ ...settings, opening_hours }),
      });
      setSettings(next); setHours(JSON.stringify(next.opening_hours, null, 2)); setMessage("Reservation settings saved.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save settings. Check the opening-hours JSON."); }
    finally { setBusy(false); }
  }

  async function addBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/reservations/blocks", {
        method: "POST", headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ starts_at: new Date(String(form.get("starts_at"))).toISOString(), ends_at: new Date(String(form.get("ends_at"))).toISOString(), reason: form.get("reason") || null }),
      });
      formElement.reset(); setMessage("Reservation block added."); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add block."); }
    finally { setBusy(false); }
  }

  async function removeBlock(id: string) {
    setBusy(true); setError("");
    try { await api(`/reservations/blocks/${id}`, { method: "DELETE", headers: { "X-Restaurant-Id": restaurantId } }); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove block."); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-5 xl:grid-cols-2">
    <Card title="Booking rules">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {([["capacity", "Seat capacity"], ["duration_minutes", "Booking duration (minutes)"], ["slot_interval_minutes", "Slot interval (minutes)"], ["buffer_minutes", "Table buffer (minutes)"]] as const).map(([key, label]) =>
            <label key={key} className="space-y-1 text-sm"><span className="font-medium">{label}</span>
              <input type="number" min={0} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-border bg-background px-3" /></label>)}
        </div>
        <label className="block space-y-1 text-sm"><span className="font-medium">Opening hours JSON (weekday keys 0=Mon … 6=Sun)</span>
          <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={7}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs" />
        </label>
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save booking rules</button>
      </form>
    </Card>
    <Card title="Manual blocks">
      <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Starts at<input required name="starts_at" type="datetime-local" className="h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
        <label className="space-y-1 text-sm">Ends at<input required name="ends_at" type="datetime-local" className="h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Reason<input name="reason" maxLength={200} className="h-10 w-full rounded-lg border border-border bg-background px-3" placeholder="Private event, maintenance…" /></label>
        <button disabled={busy} className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Add block</button>
      </form>
      <div className="mt-4 space-y-2">
        {blocks.length === 0 && <p className="text-sm text-muted-foreground">No upcoming blocks.</p>}
        {blocks.map((block) => <div key={block.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span>{new Date(block.starts_at).toLocaleString()} – {new Date(block.ends_at).toLocaleTimeString()} {block.reason && `· ${block.reason}`}</span>
          <button type="button" disabled={busy} onClick={() => removeBlock(block.id)} className="text-xs font-semibold text-danger">Remove</button>
        </div>)}
      </div>
    </Card>
    {(message || error) && <p className={`xl:col-span-2 text-sm ${error ? "text-danger" : "text-success"}`}>{error || message}</p>}
  </div>;
}
