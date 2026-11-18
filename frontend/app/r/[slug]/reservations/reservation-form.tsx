"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Slot = { starts_at: string; remaining_guests: number };
type Availability = { date: string; timezone: string; slots: Slot[] };

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ReservationForm({ slug, timeZone }: { slug: string; timeZone: string }) {
  const [date, setDate] = useState(() => localDate(timeZone));
  const [guests, setGuests] = useState(2);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selected, setSelected] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const idempotencyKey = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    setLoadingSlots(true); setError(""); setSelected(""); setAvailability(null);
    api<Availability>(`/public/reservations/availability?slug=${encodeURIComponent(slug)}&date=${date}&guests=${guests}`, { signal: controller.signal })
      .then(setAvailability)
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load available times."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false); });
    return () => controller.abort();
  }, [date, guests, slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setError("Choose an available time first."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true); setError(""); setSuccess("");
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const reservation = await api<{ id: string }>(`/public/reservations?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: idempotencyKey.current,
          customer_name: form.get("customer_name"),
          customer_phone: form.get("customer_phone") || null,
          customer_email: form.get("customer_email") || null,
          guests,
          reserved_at: selected,
          notes: form.get("notes") || null,
        }),
      });
      idempotencyKey.current = "";
      setSuccess(`Your reservation request is in. Reference: ${reservation.id.slice(0, 8).toUpperCase()}. The restaurant will confirm it.`);
      setSelected("");
      formElement.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit reservation. Please choose another time."); }
    finally { setSubmitting(false); }
  }

  function displayTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: availability?.timezone ?? "UTC" }).format(new Date(value));
  }

  return <form onSubmit={submit} className="rounded-2xl border border-[#D7DED9] bg-white p-6 shadow-sm md:p-8">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium">Date<input required type="date" min={localDate(timeZone)} value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-lg border border-[#CFD8D2] px-3" /></label>
      <label className="space-y-1.5 text-sm font-medium">Guests<select value={guests} onChange={(event) => setGuests(Number(event.target.value))} className="h-11 w-full rounded-lg border border-[#CFD8D2] px-3">{Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "guest" : "guests"}</option>)}</select></label>
    </div>
    <div className="mt-5">
      <h2 className="text-sm font-semibold">Available times</h2>
      {loadingSlots && <p className="mt-2 text-sm text-slate-500">Checking availability…</p>}
      {!loadingSlots && availability?.slots.length === 0 && <p className="mt-2 text-sm text-slate-500">No times available. Try another date or party size.</p>}
      {availability?.slots.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{availability.slots.map((slot) => <button key={slot.starts_at} type="button" aria-pressed={selected === slot.starts_at} onClick={() => setSelected(slot.starts_at)} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${selected === slot.starts_at ? "border-[#0B2A22] bg-[#0B2A22] text-white" : "border-[#CFD8D2] hover:border-[#0B2A22]"}`}>{displayTime(slot.starts_at)}</button>)}</div> : null}
    </div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium">Full name<input required name="customer_name" maxLength={200} autoComplete="name" className="h-11 w-full rounded-lg border border-[#CFD8D2] px-3" /></label>
      <label className="space-y-1.5 text-sm font-medium">Phone<input name="customer_phone" maxLength={30} autoComplete="tel" className="h-11 w-full rounded-lg border border-[#CFD8D2] px-3" /></label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Email<input type="email" name="customer_email" maxLength={320} autoComplete="email" className="h-11 w-full rounded-lg border border-[#CFD8D2] px-3" /></label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Notes or preferences<textarea name="notes" rows={3} className="w-full rounded-lg border border-[#CFD8D2] px-3 py-2" /></label>
    </div>
    {(error || success) && <p role={error ? "alert" : "status"} className={`mt-4 text-sm ${error ? "text-red-700" : "text-emerald-800"}`}>{error || success}</p>}
    <button disabled={submitting || loadingSlots || !selected} className="mt-5 h-12 w-full rounded-xl bg-[#0B2A22] px-5 text-sm font-semibold text-white transition hover:bg-[#163F34] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Sending request…" : "Request reservation"}</button>
    <p className="mt-3 text-xs text-slate-500">Your request remains pending until the restaurant confirms it.</p>
  </form>;
}
