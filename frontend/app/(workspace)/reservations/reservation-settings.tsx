"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export type ReservationSettings = {
  capacity: number;
  duration_minutes: number;
  slot_interval_minutes: number;
  buffer_minutes: number;
  opening_hours: Record<string, [string, string][]>;
};
export type ReservationBlock = { id: string; starts_at: string; ends_at: string; reason: string | null };

const WEEKDAY_NAMES = [
  { key: "0", label: "Monday" },
  { key: "1", label: "Tuesday" },
  { key: "2", label: "Wednesday" },
  { key: "3", label: "Thursday" },
  { key: "4", label: "Friday" },
  { key: "5", label: "Saturday" },
  { key: "6", label: "Sunday" },
];

export function ReservationSettingsEditor({
  restaurantId,
  initial,
  blocks: initialBlocks,
  canEdit = true,
}: {
  restaurantId: string;
  initial: ReservationSettings;
  blocks: ReservationBlock[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<ReservationSettings>(initial);
  const [blocks, setBlocks] = useState<ReservationBlock[]>(initialBlocks);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateWindow(dayKey: string, winIdx: number, index: 0 | 1, value: string) {
    setSettings((prev) => {
      const current = [...(prev.opening_hours[dayKey] ?? [])];
      const pair: [string, string] = [...(current[winIdx] ?? ["12:00", "14:30"])] as [string, string];
      pair[index] = value;
      current[winIdx] = pair;
      return {
        ...prev,
        opening_hours: { ...prev.opening_hours, [dayKey]: current },
      };
    });
  }

  function addWindow(dayKey: string) {
    setSettings((prev) => {
      const current = prev.opening_hours[dayKey] ?? [];
      const nextWindow: [string, string] = current.length === 0 ? ["12:00", "14:30"] : ["19:00", "22:00"];
      return {
        ...prev,
        opening_hours: { ...prev.opening_hours, [dayKey]: [...current, nextWindow] },
      };
    });
  }

  function removeWindow(dayKey: string, winIdx: number) {
    setSettings((prev) => {
      const current = (prev.opening_hours[dayKey] ?? []).filter((_, idx) => idx !== winIdx);
      return {
        ...prev,
        opening_hours: { ...prev.opening_hours, [dayKey]: current },
      };
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const next = await api<ReservationSettings>("/reservations/settings", {
        method: "PUT",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify(settings),
      });
      setSettings(next);
      setMessage("Reservation rules and opening hours saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save booking rules.");
    } finally {
      setBusy(false);
    }
  }

  async function addBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMessage("");
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await api<ReservationBlock>("/reservations/blocks", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          starts_at: new Date(String(form.get("starts_at"))).toISOString(),
          ends_at: new Date(String(form.get("ends_at"))).toISOString(),
          reason: form.get("reason") || null,
        }),
      });
      setBlocks((prev) => [...prev, created]);
      formElement.reset();
      setMessage("Reservation block added.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add block.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(id: string) {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reservations/blocks/${id}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove block.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Booking rules & weekly schedule">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["capacity", "Seat capacity"],
                ["duration_minutes", "Booking duration (minutes)"],
                ["slot_interval_minutes", "Slot interval (minutes)"],
                ["buffer_minutes", "Table buffer (minutes)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs font-semibold">
                <span>{label}</span>
                <input
                  type="number"
                  min={0}
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
                />
              </label>
            ))}
          </div>

          <div className="space-y-2.5 border-t border-border pt-3">
            <p className="text-xs font-semibold">Weekly service windows</p>
            {WEEKDAY_NAMES.map(({ key, label }) => {
              const windows = settings.opening_hours[key] ?? [];
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
                  <span className="w-24 font-semibold">{label}</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {windows.length === 0 && <span className="text-muted-foreground">Closed</span>}
                    {windows.map(([open, close], winIdx) => (
                      <div key={winIdx} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1">
                        <input
                          type="time"
                          value={open}
                          onChange={(e) => updateWindow(key, winIdx, 0, e.target.value)}
                          className="bg-transparent text-xs focus:outline-none"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={close}
                          onChange={(e) => updateWindow(key, winIdx, 1, e.target.value)}
                          className="bg-transparent text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeWindow(key, winIdx)}
                          className="ml-1 text-danger hover:opacity-80"
                          title="Remove window"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addWindow(key)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" /> Window
                  </button>
                </div>
              );
            })}
          </div>

          <button
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Save booking rules
          </button>
        </form>
      </Card>

      <Card title="Manual capacity blocks & closures">
        <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">
            Starts at
            <input
              required
              name="starts_at"
              type="datetime-local"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Ends at
            <input
              required
              name="ends_at"
              type="datetime-local"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold sm:col-span-2">
            Reason
            <input
              name="reason"
              maxLength={200}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
              placeholder="Private event, maintenance, holiday closure…"
            />
          </label>
          <button
            disabled={busy}
            className="w-fit rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            Add block
          </button>
        </form>
        <div className="mt-4 space-y-2">
          {blocks.length === 0 && <p className="text-sm text-muted-foreground">No upcoming blocks.</p>}
          {blocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
              <span>
                {new Date(block.starts_at).toLocaleString()} – {new Date(block.ends_at).toLocaleTimeString()}{" "}
                {block.reason && `· ${block.reason}`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeBlock(block.id)}
                className="font-semibold text-danger hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Card>
      {(message || error) && (
        <p className={`xl:col-span-2 text-sm font-medium ${error ? "text-danger" : "text-success"}`}>
          {error || message}
        </p>
      )}
    </div>
  );
}
