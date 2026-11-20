"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, Bike, CreditCard, Lock, ShoppingBag, Utensils, Wallet } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { currencySymbol } from "@/lib/currency-context";

interface CartQuote {
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  delivery_fee_minor: number;
  tax_rate_bps: number;
  estimated_tax_minor: number;
  total_minor: number;
  coupon_code: string | null;
}

function genIdempotencyKey() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lines, clearCart } = useCartStore();
  const idempotencyKey = useRef(genIdempotencyKey());

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"delivery" | "pickup" | "dine-in">(
    (searchParams.get("mode") as "delivery" | "pickup" | "dine-in") ?? "pickup"
  );
  const [tableLabel, setTableLabel] = useState(searchParams.get("table") ?? "");
  const couponCode = searchParams.get("coupon") ?? null;
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<"card" | "paypal" | "cash">("card");
  const [terms, setTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(400);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/public/restaurants/${encodeURIComponent(params.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.currency) setCurrency(data.currency);
        if (typeof data.delivery_fee_minor === "number") setDefaultDeliveryFee(data.delivery_fee_minor);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [params.slug]);

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    let active = true;
    setQuoteError("");
    fetch(`/api/v1/cart/validate?slug=${encodeURIComponent(params.slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_mode: mode,
        coupon_code: couponCode,
        lines: lines.map((l) => ({
          menu_item_id: l.menu_item_id,
          quantity: l.quantity,
          modifier_ids: l.modifier_ids ?? [],
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail ?? "Could not validate cart quote.");
        }
        return (await res.json()) as CartQuote;
      })
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((caught) => {
        if (active) {
          setQuote(null);
          setQuoteError(caught instanceof Error ? caught.message : "Could not validate cart quote.");
        }
      });
    return () => {
      active = false;
    };
  }, [lines, mode, couponCode, params.slug]);

  const sym = currencySymbol(quote?.currency ?? currency);
  const subtotal = quote ? quote.subtotal_minor : lines.reduce((a, l) => a + l.line_total_minor, 0);
  const deliveryFee = quote ? quote.delivery_fee_minor : mode === "delivery" ? defaultDeliveryFee : 0;
  const discount = quote ? quote.discount_minor : 0;
  const total = quote ? quote.total_minor : Math.max(subtotal + deliveryFee - discount, 0);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setError("Your cart is empty."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/orders?slug=${encodeURIComponent(params.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: idempotencyKey.current,
          customer_name: fullName,
          customer_phone: phone || null,
          customer_email: email || null,
          service_mode: mode,
          table_label: mode === "dine-in" ? tableLabel.trim() || null : null,
          delivery_address: mode === "delivery" ? address : null,
          payment_method: payment,
          coupon_code: couponCode,
          lines: lines.map((l) => ({
            menu_item_id: l.menu_item_id,
            quantity: l.quantity,
            modifier_ids: l.modifier_ids ?? [],
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail ?? "Failed to place order. Please try again.");
        return;
      }
      const order = await res.json();
      if (payment !== "cash") {
        await fetch("/api/v1/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            slug: params.slug,
            provider: payment === "paypal" ? "paypal" : "sandbox",
            idempotency_key: idempotencyKey.current,
          }),
        }).catch(() => {});
      }
      clearCart(params.slug);
      router.push(`/r/${params.slug}/order-confirmation/${order.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "h-10 w-full rounded-xl border border-border bg-white px-3.5 text-xs text-[#0B2A22] focus:outline-none";

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left opacity-40 lg:opacity-100" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[#0B2A22] sm:text-4xl lg:text-5xl">Your order</h1>
          <p className="mt-2 text-sm font-medium text-[#0B2A22]/90 sm:text-lg">Just a few steps before enjoying your meal</p>
        </div>
      </section>

      <form onSubmit={handleConfirm} className="grid gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="rounded-2xl border border-border bg-white p-6 space-y-6 lg:col-span-7">
          <div>
            <h2 className="text-base font-bold text-[#0B2A22]">1. Your contact details</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Full name *</label><input required type="text" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} /></div>
              <div><label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Phone</label><input type="text" placeholder="Your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="mt-3"><label className="mb-1 block text-xs font-semibold text-[#0B2A22]">Email</label><input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></div>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#0B2A22]">2. Service mode</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([["delivery", Bike, "Delivery", "To your door"], ["pickup", ShoppingBag, "Takeaway", "Pickup at restaurant"], ["dine-in", Utensils, "Dine-in", "At the restaurant"]] as const).map(([key, Icon, label, sub]) => (
                <button key={key} type="button" onClick={() => setMode(key)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${mode === key ? "border-[#CBE0D5] bg-[#DCF0E5]" : "border-border bg-white"}`}>
                  <Icon className="h-5 w-5 text-[#0B2A22]" />
                  <div><p className="text-xs font-bold text-[#0B2A22]">{label}</p><p className="text-[11px] text-slate-600">{sub}</p></div>
                </button>
              ))}
            </div>
          </div>

          {mode === "delivery" && (
            <div>
              <h2 className="text-base font-bold text-[#0B2A22]">3. Delivery address</h2>
              <input required type="text" placeholder="Your delivery address" value={address} onChange={(e) => setAddress(e.target.value)} className={`mt-2.5 ${inputClass}`} />
            </div>
          )}

          {mode === "dine-in" && (
            <div>
              <h2 className="text-base font-bold text-[#0B2A22]">3. Table number</h2>
              <input type="text" placeholder="e.g. Table 4" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} className={`mt-2.5 ${inputClass}`} />
            </div>
          )}

          <div>
            <h2 className="text-base font-bold text-[#0B2A22]">{mode === "delivery" ? "4." : "3."} Payment method</h2>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
              {([["card", CreditCard, "Credit card"], ["paypal", Wallet, "PayPal"], ["cash", Banknote, "Cash on delivery"]] as const).map(([key, Icon, label]) => (
                <button key={key} type="button" onClick={() => setPayment(key)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold transition ${payment === key ? "border-[#CBE0D5] bg-[#DCF0E5]" : "border-border bg-white"}`}>
                  <Icon className="h-4 w-4 text-[#0B2A22]" /> {label}
                </button>
              ))}
            </div>
            {payment !== "cash" && (
              <p className="mt-2 text-[11px] text-slate-500">
                A payment checkout reference will be created securely with your order and verified via provider webhook.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
            <h2 className="text-lg font-bold text-[#0B2A22]">Order summary</h2>
            <div className="space-y-3.5">
              {lines.map((line) => (
                <div key={line.cart_key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0B2A22]">{line.name}</p>
                    <p className="text-xs text-slate-500">Qty: {line.quantity}</p>
                    {line.modifiers_snapshot && line.modifiers_snapshot.length > 0 && (
                      <p className="text-[11px] text-slate-400">{line.modifiers_snapshot.map((m) => m.name).join(", ")}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-[#0B2A22]">{sym}{(line.line_total_minor / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border pt-4 text-xs">
              <div className="flex justify-between"><span className="font-semibold text-[#0B2A22]">Subtotal</span><span className="font-bold text-[#0B2A22]">{sym}{(subtotal / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Delivery fee</span><span className="font-semibold">{sym}{(deliveryFee / 100).toFixed(2)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promo {quote?.coupon_code ? `(${quote.coupon_code})` : ""}</span>
                  <span className="font-semibold">-{sym}{(discount / 100).toFixed(2)}</span>
                </div>
              )}
              {quote && quote.estimated_tax_minor > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Estimated tax ({(quote.tax_rate_bps / 100).toFixed(1)}% incl.)</span>
                  <span>{sym}{(quote.estimated_tax_minor / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#DCF0E5] px-4 py-3">
              <span className="text-sm font-bold text-[#0B2A22]">Total</span>
              <span className="text-lg font-extrabold text-[#0B2A22]">{sym}{(total / 100).toFixed(2)}</span>
            </div>
            {quoteError && <p role="alert" className="text-xs font-semibold text-amber-700">{quoteError}</p>}
            {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
            <label className="flex items-center gap-2.5 text-xs text-slate-600">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-4 w-4 rounded border-slate-400" />
              <span>
                I accept the{" "}
                <Link href={`/r/${params.slug}/legal`} className="font-semibold text-[#0B2A22] underline">
                  terms and cancellation policy
                </Link>
                .
              </span>
            </label>
            <button type="submit" disabled={!terms || loading || Boolean(quoteError)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C4933F] text-sm font-bold text-[#0B2A22] shadow-sm transition hover:bg-[#b8852e] disabled:opacity-60">
              <Lock className="h-4 w-4" /> {loading ? "Placing order…" : "Place order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
