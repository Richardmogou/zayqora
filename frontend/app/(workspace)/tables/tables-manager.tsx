"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export interface DiningTableItem {
  id: string;
  area_name: string;
  label: string;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "blocked";
  qr_token: string;
  is_active: boolean;
}

const STATUS_TONE: Record<string, Tone> = {
  available: "success",
  occupied: "warning",
  reserved: "info",
  blocked: "danger",
};

export function TablesManager({
  restaurantId,
  restaurantSlug,
  role,
  initialTables,
}: {
  restaurantId: string;
  restaurantSlug: string;
  role: string;
  initialTables: DiningTableItem[];
}) {
  const [tables, setTables] = useState<DiningTableItem[]>(initialTables);
  const [areaName, setAreaName] = useState("Main Hall");
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canManage = role === "owner" || role === "manager";

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !label.trim()) return;
    setError("");
    setNotice("");
    try {
      const created = await api<DiningTableItem>("/tables", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ area_name: areaName.trim() || "Main Hall", label: label.trim(), capacity }),
      });
      setTables((prev) => [...prev, created]);
      setLabel("");
      setNotice(`Table "${created.label}" created with a unique QR token.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create table.");
    }
  }

  async function handleStatus(tableId: string, status: DiningTableItem["status"]) {
    setBusyId(tableId);
    setError("");
    try {
      const updated = await api<DiningTableItem>(`/tables/${tableId}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ status }),
      });
      setTables((prev) => prev.map((t) => (t.id === tableId ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update table.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotateQr(tableId: string) {
    if (!canManage) return;
    setBusyId(tableId);
    setError("");
    setNotice("");
    try {
      const updated = await api<DiningTableItem>(`/tables/${tableId}/rotate-qr`, {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setTables((prev) => prev.map((t) => (t.id === tableId ? updated : t)));
      setNotice(`QR token rotated for ${updated.label}. Previous QR codes are revoked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate QR token.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tableId: string) {
    if (!canManage) return;
    setBusyId(tableId);
    setError("");
    try {
      await api(`/tables/${tableId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setTables((prev) => prev.filter((t) => t.id !== tableId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete table.");
    } finally {
      setBusyId(null);
    }
  }

  function qrPath(token: string) {
    return `/r/${restaurantSlug}/table/${token}`;
  }

  async function copyLink(token: string) {
    const full = `${window.location.origin}${qrPath(token)}`;
    await navigator.clipboard.writeText(full).catch(() => {});
    setNotice(`Copied QR ordering link: ${full}`);
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{notice}</p>}

      {canManage && (
        <Card title="Add dining table & generate QR code">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Dining area</label>
              <input value={areaName} onChange={(e) => setAreaName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Table label *</label>
              <input required placeholder="Table 1, Terrace A…" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Seats</label>
              <input type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inputClass} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> Create table
              </button>
            </div>
          </form>
        </Card>
      )}

      {tables.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tables configured yet. Create tables above to manage floor status and QR table ordering.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <Card key={table.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{table.area_name}</p>
                  <h3 className="text-lg font-bold text-primary">{table.label}</h3>
                </div>
                <Badge tone={STATUS_TONE[table.status] ?? "neutral"}>{table.status}</Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Users className="h-3.5 w-3.5 text-primary" /> {table.capacity} seats
                </span>
                <select
                  disabled={busyId === table.id}
                  value={table.status}
                  onChange={(e) => void handleStatus(table.id, e.target.value as DiningTableItem["status"])}
                  className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[11px]">
                <p className="font-semibold text-muted-foreground">QR ordering link</p>
                <p className="mt-0.5 truncate font-mono">{qrPath(table.qr_token)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void copyLink(table.qr_token)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy QR URL
                </button>
                <Link
                  href={qrPath(table.qr_token)}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Link>
                {canManage && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === table.id}
                      onClick={() => void handleRotateQr(table.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Rotate
                    </button>
                    <button
                      type="button"
                      disabled={busyId === table.id}
                      onClick={() => void handleDelete(table.id)}
                      className="ml-auto rounded-lg p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                      title="Delete table"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
