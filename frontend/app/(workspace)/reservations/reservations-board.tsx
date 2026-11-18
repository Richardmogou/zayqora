"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calendar, List, Plus, Search, Trash2, Users } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ReservationActions } from "./reservation-actions";

export type ReservationItem = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  guests: number;
  table_label: string | null;
  reserved_at: string;
  notes: string | null;
  status: string;
};

const STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  confirmed: "success",
  seated: "info",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};

const TABLES = [
  "",
  "Table 1",
  "Table 2",
  "Table 3",
  "Table 4",
  "Table 5",
  "Table 6",
  "Table 7",
  "Table 8",
  "Table 9",
  "Table 10",
  "Table 12",
  "VIP Room",
  "Terrace 1",
  "Terrace 2",
];

const CALENDAR_SLOTS = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

export function ReservationsBoard({
  restaurantId,
  initialDate,
  initialReservations,
  capacity,
  timeZone,
  role,
}: {
  restaurantId: string;
  initialDate: string;
  initialReservations: ReservationItem[];
  capacity: number;
  timeZone: string;
  role: string;
}) {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<string>(initialDate);
  const [allDates, setAllDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [reservations, setReservations] = useState<ReservationItem[]>(initialReservations);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newCustomer, setNewCustomer] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGuests, setNewGuests] = useState(2);
  const [newTime, setNewTime] = useState(`${initialDate}T19:30`);
  const [newTable, setNewTable] = useState("Table 1");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const canEdit = role === "owner" || role === "manager";

  async function reload(targetDate = dateFilter, showAll = allDates) {
    setLoading(true);
    setError("");
    try {
      const query = showAll ? "" : `?date=${encodeURIComponent(targetDate)}`;
      const list = await api<ReservationItem[]>(`/reservations${query}`, {
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setReservations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reservations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload(dateFilter, allDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, allDates, restaurantId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !newCustomer.trim() || !newTime) return;
    setCreating(true);
    setError("");
    try {
      const isoTime = new Date(newTime).toISOString();
      await api<ReservationItem>("/reservations", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          customer_name: newCustomer.trim(),
          customer_phone: newPhone.trim() || null,
          customer_email: newEmail.trim() || null,
          guests: newGuests,
          table_label: newTable || null,
          reserved_at: isoTime,
          notes: newNotes.trim() || null,
        }),
      });
      setNewCustomer("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setShowCreate(false);
      await reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create reservation.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignTable(resId: string, tableLabel: string) {
    if (!canEdit) return;
    setBusyId(resId);
    setError("");
    try {
      const updated = await api<ReservationItem>(`/reservations/${resId}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ table_label: tableLabel || null }),
      });
      setReservations((prev) => prev.map((item) => (item.id === resId ? updated : item)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign table.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(resId: string) {
    if (!canEdit) return;
    setBusyId(resId);
    setError("");
    try {
      await api(`/reservations/${resId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setReservations((prev) => prev.filter((item) => item.id !== resId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete reservation.");
    } finally {
      setBusyId(null);
    }
  }

  function formatTime(iso: string) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone,
    }).format(new Date(iso));
  }

  const query = search.trim().toLowerCase();
  const filtered = reservations.filter((r) => {
    return (
      (statusFilter === "ALL" || r.status === statusFilter) &&
      (!query ||
        r.customer_name.toLowerCase().includes(query) ||
        (r.customer_phone ?? "").toLowerCase().includes(query) ||
        (r.table_label ?? "").toLowerCase().includes(query))
    );
  });

  const activeCovers = filtered
    .filter((r) => ["pending", "confirmed", "seated"].includes(r.status))
    .reduce((sum, r) => sum + r.guests, 0);

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              disabled={allDates}
              value={dateFilter}
              onChange={(e) => {
                setAllDates(false);
                setDateFilter(e.target.value);
              }}
              className="bg-transparent text-xs font-semibold focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                setAllDates(false);
                setDateFilter(initialDate);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                !allDates && dateFilter === initialDate ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAllDates((prev) => !prev)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                allDates ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              All dates
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>

          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guest, phone, table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs focus:outline-none sm:w-56"
            />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold">
            <Users className="h-3.5 w-3.5 text-primary" /> {activeCovers} / {capacity} active covers
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
                viewMode === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Calendar view
            </button>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Create a reservation
            </button>
          )}
        </div>
      </div>

      {showCreate && canEdit && (
        <Card title="New reservation (Walk-in / Phone booking)">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Customer name *</label>
              <input
                required
                type="text"
                placeholder="Guest name"
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Phone</label>
              <input
                type="text"
                placeholder="+33 6..."
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Email</label>
              <input
                type="email"
                placeholder="guest@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Date &amp; time *</label>
              <input
                required
                type="datetime-local"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Guests *</label>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={newGuests}
                onChange={(e) => setNewGuests(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Assigned table</label>
              <select value={newTable} onChange={(e) => setNewTable(e.target.value)} className={inputClass}>
                {TABLES.map((t) => (
                  <option key={t || "unassigned"} value={t}>
                    {t || "Unassigned"}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Notes / preferences</label>
              <input
                type="text"
                placeholder="Window seat, birthday, high chair..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={creating}
                className="h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Saving..." : "Save booking"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {viewMode === "calendar" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card title="Daily timeline" className="lg:col-span-5">
            <div className="space-y-2.5">
              {CALENDAR_SLOTS.map((slot) => {
                const matches = filtered.filter((r) => formatTime(r.reserved_at) === slot);
                return (
                  <div key={slot} className="grid grid-cols-12 items-start gap-3">
                    <span className="col-span-2 pt-2.5 text-xs font-semibold text-muted-foreground">{slot}</span>
                    <div className="col-span-10 space-y-1.5">
                      {matches.length > 0 ? (
                        matches.map((match) => (
                          <div
                            key={match.id}
                            className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2"
                          >
                            <div>
                              <p className="text-xs font-bold">{match.customer_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {match.guests} guests · {match.table_label || "Unassigned"}
                              </p>
                            </div>
                            <Badge tone={STATUS_TONE[match.status] ?? "neutral"}>
                              {match.status.replaceAll("_", " ")}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="h-9 rounded-xl border border-dashed border-border/70 bg-muted/20" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="lg:col-span-7">{renderTable()}</div>
        </div>
      ) : (
        renderTable()
      )}
    </div>
  );

  function renderTable() {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">
            {allDates ? "All bookings" : `Bookings for ${dateFilter}`} ({filtered.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Guests</th>
                <th className="px-5 py-3">Table</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Loading bookings...
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">
                      {allDates && <span className="mr-1.5 text-xs text-muted-foreground">{formatDate(reservation.reserved_at)}</span>}
                      {formatTime(reservation.reserved_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{reservation.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {reservation.customer_phone ?? reservation.customer_email ?? ""}
                        {reservation.notes ? ` · ${reservation.notes}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3">{reservation.guests}</td>
                    <td className="px-5 py-3">
                      {canEdit ? (
                        <select
                          disabled={busyId === reservation.id}
                          value={reservation.table_label ?? ""}
                          onChange={(e) => void handleAssignTable(reservation.id, e.target.value)}
                          className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium focus:outline-none"
                        >
                          {TABLES.map((t) => (
                            <option key={t || "unassigned"} value={t}>
                              {t || "Assign table…"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{reservation.table_label ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 capitalize">
                      <Badge tone={STATUS_TONE[reservation.status] ?? "neutral"}>
                        {reservation.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <ReservationActions
                          reservationId={reservation.id}
                          restaurantId={restaurantId}
                          status={reservation.status}
                          role={role}
                          onUpdated={() => void reload()}
                        />
                        {canEdit && (
                          <button
                            type="button"
                            disabled={busyId === reservation.id}
                            onClick={() => void handleDelete(reservation.id)}
                            title="Delete reservation"
                            className="rounded-lg p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No reservations match the selected date and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }
}
