"use client";
import { useCartStore } from "@/lib/cart-store";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bike, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";

export default function CartPage({ params }: { params: { slug: string } }) {
  const base = `/r/${params.slug}`;
  const { lines, updateQty, removeLine } = useCartStore();
  const [promo, setPromo] = useState("");
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");

  const subtotal = lines.reduce((a, l) => a + l.line_total_minor, 0);
  const deliveryFee = mode === "delivery" ? 400 : 0;
  const total = subtotal + deliveryFee;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 px-8 text-center">
        <p className="text-2xl font-bold text-[#0B2A22]">Your cart is empty</p>
        <Link href={`${base}/menu`} className="rounded-xl bg-[#0B2A22] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[#163F34]">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left opacity-40 lg:opacity-100" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[#0B2A22] sm:text-4xl lg:text-5xl">Your cart</h1>
          <p className="mt-2 text-sm font-medium text-[#0B2A22]/90 sm:text-lg">Exceptional dishes, soon at your table</p>
        </div>
      </section>

      <div className="grid gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="text-lg font-bold text-[#0B2A22]">Selected items ({lines.length})</h2>
            <div className="mt-4 divide-y divide-border">
              {lines.map((line) => (
                <div key={line.cart_key} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-2 last:pb-0">
                  <div className="max-w-md">
                    <h3 className="text-base font-bold text-[#0B2A22]">{line.name}</h3>
                    {line.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{line.description}</p>}
                    {line.modifiers_snapshot && line.modifiers_snapshot.length > 0 && (
                      <span className="mt-2 inline-block rounded-lg bg-[#DCF0E5] px-2.5 py-0.5 text-[11px] font-semibold text-[#0B2A22]">
                        {line.modifiers_snapshot.map((m) => m.name).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-[#0B2A22]">&euro;{(line.line_total_minor / 100).toFixed(2)}</span>
                      <div className="inline-flex items-center rounded-xl border border-border bg-white">
                        <button type="button" onClick={() => updateQty(line.cart_key, -1)} className="px-2.5 py-1.5 text-[#0B2A22] hover:bg-[#F6F4EF]"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="px-3 text-sm font-bold text-[#0B2A22]">{line.quantity}</span>
                        <button type="button" onClick={() => updateQty(line.cart_key, 1)} className="px-2.5 py-1.5 text-[#0B2A22] hover:bg-[#F6F4EF]"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeLine(line.cart_key)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#B4322A] hover:underline">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Link href={`${base}/menu`} className="inline-flex items-center gap-2 rounded-xl border border-[#0B2A22]/40 bg-white px-5 py-2.5 text-xs font-semibold text-[#0B2A22] hover:bg-[#E5F1EB]">
            <ArrowLeft className="h-4 w-4" /> Continue shopping
          </Link>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-white p-6 space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#0B2A22]">Promo code</label>
              <div className="mt-2 flex gap-2">
                <input type="text" placeholder="Enter a promo code" value={promo} onChange={(e) => setPromo(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-border bg-white px-3.5 text-xs text-[#0B2A22] focus:outline-none" />
                <button type="button" className="rounded-xl bg-[#7E998F] px-5 text-xs font-semibold text-white transition hover:bg-[#0B2A22]">Apply</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0B2A22]">Pickup or delivery</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {([["pickup", ShoppingBag, "Pickup", "Pick up at the restaurant"], ["delivery", Bike, "Delivery", "Have it delivered to your door"]] as const).map(([key, Icon, label, sub]) => (
                  <button key={key} type="button" onClick={() => setMode(key)}
                    className={`rounded-2xl border p-4 text-center transition ${mode === key ? "border-[#CBE0D5] bg-[#DCF0E5]" : "border-border bg-white"}`}>
                    <Icon className="mx-auto h-5 w-5 text-[#0B2A22]" />
                    <p className="mt-2 text-sm font-bold text-[#0B2A22]">{label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-bold text-[#0B2A22]">&euro;{(subtotal / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Fees</span><span className="font-medium text-[#0B2A22]">{mode === "delivery" ? "€4.00" : "Calculated at checkout"}</span></div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-lg font-bold text-[#0B2A22]">Total</span>
                <span className="text-xl font-extrabold text-[#C4933F]">&euro;{(total / 100).toFixed(2)}</span>
              </div>
            </div>

            <Link
              href={`${base}/checkout?mode=${mode}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2A22] text-sm font-semibold text-white transition hover:bg-[#163F34]"
            >
              Proceed to checkout <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
