import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle, ShoppingBag, Utensils } from "lucide-react";

const API = process.env.API_ORIGIN ?? "http://localhost:8000";

interface OrderLine { id: string; name: string; quantity: number; line_total_minor: number; }
interface OrderDetail {
  id: string; status: string; service_mode: string;
  total_minor: number; lines: OrderLine[];
}

const STEPS = ["received", "confirmed", "in_preparation", "ready", "served"];
const STEP_LABELS: Record<string, string> = {
  received: "Received", confirmed: "Confirmed", in_preparation: "In preparation",
  ready: "Ready", served: "Completed",
};
const SERVICE_ICONS: Record<string, React.ElementType> = {
  pickup: ShoppingBag, "dine-in": Utensils, delivery: ShoppingBag,
};
const SERVICE_LABELS: Record<string, string> = {
  pickup: "Takeaway", "dine-in": "Dine-in", delivery: "Delivery",
};

export default async function OrderTrackingPage({ params }: { params: { slug: string; id: string } }) {
  const base = `/r/${params.slug}`;
  const res = await fetch(`${API}/api/v1/public/orders/${params.id}?slug=${params.slug}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const order: OrderDetail = await res.json();

  const currentStep = STEPS.indexOf(order.status);
  const Icon = SERVICE_ICONS[order.service_mode] ?? ShoppingBag;

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-8 py-7">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left" />
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-[#0B2A22]">Order tracking</h1>
          <p className="mt-2 text-lg font-medium text-[#0B2A22]/90">We are preparing your meal with care</p>
        </div>
      </section>

      <div className="space-y-6 px-8">
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-2xl font-bold text-[#0B2A22]">Order #{order.id.slice(0, 8).toUpperCase()}</h2>
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
                    <span className="text-sm font-bold text-[#0B2A22]">&euro;{(line.line_total_minor / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href={base} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2A22] px-6 text-xs font-semibold text-white transition hover:bg-[#163F34]">
              ← Back to home
            </Link>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
              <h2 className="text-lg font-bold text-[#0B2A22]">{SERVICE_LABELS[order.service_mode] ?? order.service_mode}</h2>
              <div className="flex items-start gap-4 rounded-2xl bg-[#E5F1EB] p-5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-[#0B2A22] shadow-sm">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-bold text-[#0B2A22]">{SERVICE_LABELS[order.service_mode]}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Total: <strong>&euro;{(order.total_minor / 100).toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <a href="#contact" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0B2A22]/40 bg-white text-xs font-semibold text-[#0B2A22] transition hover:bg-[#E5F1EB]">
                <MessageCircle className="h-4 w-4" /> Contact the restaurant
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
