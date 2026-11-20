"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, MessageCircle, ShoppingBag, Star, Utensils } from "lucide-react";

export interface TrackedOrderDetail {
  id: string;
  status: string;
  service_mode: string;
  total_minor: number;
  discount_minor?: number;
  delivery_fee_minor?: number;
  cancellation_reason?: string | null;
  lines: { id: string; name: string; quantity: number; line_total_minor: number }[];
}

const STEPS = ["received", "confirmed", "in_preparation", "ready", "served"];
const STEP_LABELS: Record<string, string> = {
  received: "Received",
  confirmed: "Confirmed",
  in_preparation: "In preparation",
  ready: "Ready",
  served: "Completed",
};
const SERVICE_LABELS: Record<string, string> = {
  pickup: "Takeaway",
  "dine-in": "Dine-in",
  delivery: "Delivery",
};

export function OrderTrackingClient({
  slug,
  sym,
  initialOrder,
}: {
  slug: string;
  sym: string;
  initialOrder: TrackedOrderDetail;
}) {
  const base = `/r/${slug}`;
  const [order, setOrder] = useState<TrackedOrderDetail>(initialOrder);
  const [reason, setReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order.status === "served" || order.status === "cancelled") return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/public/orders/${order.id}?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (res.ok) setOrder((await res.json()) as TrackedOrderDetail);
      } catch {}
    }, 15000);
    return () => window.clearInterval(timer);
  }, [order.id, order.status, slug]);

  async function handleCancel() {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/orders/${order.id}/cancel?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || "Cancelled by customer" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Could not cancel order.");
      }
      setOrder((await res.json()) as TrackedOrderDetail);
      setShowCancel(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel order.");
    } finally {
      setCancelling(false);
    }
  }

  const isCancelled = order.status === "cancelled";
  const canCancel = order.status === "received" || order.status === "confirmed";
  const currentStep = STEPS.indexOf(order.status);
  const Icon = order.service_mode === "dine-in" ? Utensils : ShoppingBag;

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-4 py-6 sm:px-8 sm:py-7">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left opacity-40 lg:opacity-100" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[#0B2A22] sm:text-5xl">Order tracking</h1>
          <p className="mt-2 text-sm font-medium text-[#0B2A22]/90 sm:text-lg">
            {isCancelled ? "This order has been cancelled." : "Live status updates every 15 seconds"}
          </p>
        </div>
      </section>

      <div className="space-y-6 px-4 sm:px-8">
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-[#0B2A22]">Order #{order.id.slice(0, 8).toUpperCase()}</h2>
            {order.status === "served" && (
              <Link
                href={`${base}/reviews?order=${order.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C4933F] px-4 py-2 text-xs font-bold text-[#0B2A22] hover:bg-[#b8852e]"
              >
                <Star className="h-3.5 w-3.5" /> Leave a review
              </Link>
            )}
          </div>

          {isCancelled ? (
            <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-bold">Order cancelled</p>
                {order.cancellation_reason && <p className="mt-0.5 text-xs">{order.cancellation_reason}</p>}
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-6 max-w-4xl">
              <div className="relative flex items-center justify-between">
                <div className="absolute inset-x-8 top-5 h-0.5 bg-slate-300" />
                {currentStep > 0 && (
                  <div
                    className="absolute left-8 top-5 h-0.5 bg-[#0B2A22] transition-all"
                    style={{ right: `${((STEPS.length - 1 - currentStep) / (STEPS.length - 1)) * 100}%` }}
                  />
                )}
                {STEPS.map((step, i) => (
                  <div key={step} className="relative z-10 flex flex-col items-center">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${i < currentStep ? "bg-[#0B2A22] text-white" : i === currentStep ? "border-4 border-[#CBE0D5] bg-[#1D6846] text-white shadow-sm" : "border-2 border-slate-300 bg-white"}`}>
                      {i < currentStep && <Check className="h-5 w-5" />}
                    </span>
                    <span className={`mt-2 text-xs font-semibold ${i > currentStep ? "text-slate-400" : "text-[#0B2A22]"}`}>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-border bg-white p-6 lg:col-span-7">
            <h2 className="text-lg font-bold text-[#0B2A22]">Order details</h2>
            <div className="mt-4 divide-y divide-border">
              {order.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-0">
                  <span className="text-sm font-bold text-[#0B2A22]">{line.name}</span>
                  <div className="flex items-center gap-10">
                    <span className="text-xs font-semibold text-slate-600">x {line.quantity}</span>
                    <span className="text-sm font-bold text-[#0B2A22]">{sym}{(line.line_total_minor / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href={base} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2A22] px-6 text-xs font-semibold text-white transition hover:bg-[#163F34]">
              Back to home
            </Link>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-border bg-white p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#0B2A22]">{SERVICE_LABELS[order.service_mode] ?? order.service_mode}</h2>
              <div className="flex items-start gap-4 rounded-2xl bg-[#E5F1EB] p-5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-[#0B2A22] shadow-sm">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-bold text-[#0B2A22]">{SERVICE_LABELS[order.service_mode] ?? order.service_mode}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Total: <strong>{sym}{(order.total_minor / 100).toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              {canCancel && (
                <div className="space-y-2.5 border-t border-border pt-3">
                  {!showCancel ? (
                    <button
                      type="button"
                      onClick={() => setShowCancel(true)}
                      className="h-10 w-full rounded-xl border border-red-300 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Cancel order
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for cancellation (optional)"
                        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-xs focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={cancelling}
                          onClick={() => void handleCancel()}
                          className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelling ? "Cancelling…" : "Confirm cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancel(false)}
                          className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  )}
                  {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
                </div>
              )}

              <Link href={`${base}/contact`} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0B2A22]/40 bg-white text-xs font-semibold text-[#0B2A22] transition hover:bg-[#E5F1EB]">
                <MessageCircle className="h-4 w-4" /> Contact the restaurant
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
