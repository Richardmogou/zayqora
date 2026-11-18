import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, FileText, Search } from "lucide-react";

const API = process.env.API_ORIGIN ?? "http://localhost:8000";

interface OrderLine { id: string; name: string; quantity: number; line_total_minor: number; }
interface OrderDetail {
  id: string; status: string; service_mode: string; customer_name: string;
  subtotal_minor: number; delivery_fee_minor: number; total_minor: number;
  lines: OrderLine[];
}

const STEPS = ["received", "confirmed", "in_preparation", "ready"];
const STEP_LABELS: Record<string, string> = {
  received: "Received", confirmed: "Confirmed", in_preparation: "In preparation", ready: "Ready",
};

export default async function OrderConfirmationPage({ params }: { params: { slug: string; id: string } }) {
  const base = `/r/${params.slug}`;
  const res = await fetch(`${API}/api/v1/public/orders/${params.id}?slug=${params.slug}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const order: OrderDetail = await res.json();

  const currentStep = STEPS.indexOf(order.status);

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-8 py-7">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left" />
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-[#0B2A22]">Thank you for your order</h1>
          <p className="mt-2 text-lg font-medium text-[#0B2A22]/90">We truly appreciate your trust</p>
        </div>
      </section>

      <div className="space-y-6 px-8">
        <div className="grid gap-6 rounded-2xl border border-[#CBE0D5] bg-[#E3EFE9] p-6 md:grid-cols-12">
          <div className="flex items-center gap-4 md:col-span-7">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#CCE2D6] text-[#0B2A22]">
              <FileText className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-[#0B2A22]">Order #{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-sm font-medium text-[#0B2A22]/80">Order received</p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-[#CBE0D5] pt-4 md:col-span-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#CCE2D6] text-[#0B2A22]">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#0B2A22]">Estimated time</p>
              <p className="text-xs text-slate-600">To be confirmed shortly</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mx-auto max-w-3xl py-2">
          <div className="relative flex items-center justify-between">
            <div className="absolute inset-x-6 top-4 h-0.5 bg-slate-300" />
            {STEPS.map((step, i) => (
              <div key={step} className="relative z-10 flex flex-col items-center">
                <span className={`grid h-9 w-9 place-items-center rounded-full border-2 ${i <= currentStep ? "border-[#0B2A22] bg-[#0B2A22] text-white" : "border-slate-300 bg-white text-slate-400"}`}>
                  {i <= currentStep && <Check className="h-4 w-4" />}
                </span>
                <span className="mt-2 text-xs font-semibold text-[#0B2A22]">{STEP_LABELS[step]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-border bg-white p-6 lg:col-span-7">
            <h2 className="text-lg font-bold text-[#0B2A22]">Order summary</h2>
            <div className="mt-4 divide-y divide-border">
              {order.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-0">
                  <span className="text-sm font-bold text-[#0B2A22]">{line.name}</span>
                  <div className="flex items-center gap-10">
                    <span className="text-xs font-semibold text-slate-600">x {line.quantity}</span>
                    <span className="text-sm font-bold text-[#C4933F]">&euro;{(line.line_total_minor / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 space-y-5 lg:col-span-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-bold text-[#0B2A22]">&euro;{(order.subtotal_minor / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Delivery fee</span><span className="font-bold text-[#0B2A22]">&euro;{(order.delivery_fee_minor / 100).toFixed(2)}</span></div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-base font-bold text-[#0B2A22]">Total</span>
                <span className="text-2xl font-extrabold text-[#C4933F]">&euro;{(order.total_minor / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <Link href={`${base}/order-tracking/${order.id}`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2A22] text-xs font-semibold text-white transition hover:bg-[#163F34]">
                <Search className="h-4 w-4" /> Track my order
              </Link>
              <Link href={`${base}/menu`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#D2E8DC] text-xs font-semibold text-[#0B2A22] transition hover:bg-[#C3DFD0]">
                Back to menu
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
