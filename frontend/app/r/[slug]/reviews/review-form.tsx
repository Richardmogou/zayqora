"use client";

import { useState, type FormEvent } from "react";

export function PublicReviewForm({ slug, defaultOrderId = "" }: { slug: string; defaultOrderId?: string }) {
  const [customerName, setCustomerName] = useState("");
  const [orderId, setOrderId] = useState(defaultOrderId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/restaurants/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          order_id: orderId.trim() || null,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Could not submit review.");
      }
      setDone(true);
      setCustomerName("");
      setComment("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit review.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-white px-3.5 text-xs text-[#0B2A22] focus:border-[#0B2A22] focus:outline-none";

  if (done) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900">
        Thank you for your feedback. Your review has been submitted for restaurant moderation.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Your name *</label>
          <input
            required
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Rating *</label>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className={inputClass}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} / 5
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Order ID (optional)</label>
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order UUID for verified-order review"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Comment</label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us about your food and service experience..."
          className="w-full rounded-xl border border-border bg-white p-3 text-xs text-[#0B2A22] focus:border-[#0B2A22] focus:outline-none"
        />
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-xl bg-[#0B2A22] px-5 text-xs font-semibold text-white transition hover:bg-[#163F34] disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
