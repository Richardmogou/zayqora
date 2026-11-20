"use client";

import { useState, type FormEvent } from "react";

export function PublicContactForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/restaurants/${encodeURIComponent(slug)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Could not send message.");
      }
      setSent(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-white px-3.5 text-xs text-[#0B2A22] focus:border-[#0B2A22] focus:outline-none";

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900">
        Your message has been delivered to the restaurant team.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Full name *</label>
          <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Phone (optional)</label>
        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Message *</label>
        <textarea
          required
          minLength={5}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Questions about private events, allergies, group bookings..."
          className="w-full rounded-xl border border-border bg-white p-3 text-xs text-[#0B2A22] focus:border-[#0B2A22] focus:outline-none"
        />
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-xl bg-[#0B2A22] px-5 text-xs font-semibold text-white transition hover:bg-[#163F34] disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
