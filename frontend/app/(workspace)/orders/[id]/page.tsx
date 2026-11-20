import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { OrderPrintButton, OrderRefundCard, type PaymentTxItem } from "./order-refund-card";
import OrderStatusActions from "./order-status-actions";

interface OrderLine {
  id: string; name: string; quantity: number; unit_price_minor: number;
  line_total_minor: number; modifiers_snapshot: { name: string; price_delta_minor: number }[] | null;
}
interface OrderDetail {
  id: string; customer_name: string; customer_phone: string | null; customer_email: string | null;
  service_mode: string; table_label: string | null; payment_method: string;
  subtotal_minor: number; discount_minor?: number; delivery_fee_minor: number; total_minor: number;
  status: string; created_at: string; lines: OrderLine[];
}

const STATUS_TONE: Record<string, Tone> = {
  received: "info", confirmed: "info", in_preparation: "warning",
  ready: "success", out_for_delivery: "warning", served: "success", cancelled: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  received: "Received", confirmed: "Confirmed", in_preparation: "In preparation",
  ready: "Ready", out_for_delivery: "Out for delivery", served: "Served", cancelled: "Cancelled",
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const role = membership?.role ?? "";
  if (!restaurantId) notFound();

  const headers = { "X-Restaurant-Id": restaurantId };
  const [order, restaurant, payments] = await Promise.all([
    serverFetch<OrderDetail>(`/orders/${params.id}`, headers),
    serverFetch<RestaurantInfo>("/restaurants/me", headers),
    serverFetch<PaymentTxItem[]>(`/payments?order_id=${params.id}`, headers),
  ]);
  if (!order) notFound();

  const sym = currencySymbol(restaurant?.currency ?? "EUR");
  const tone = STATUS_TONE[order.status] ?? "neutral";
  const date = new Date(order.created_at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Order detail" description={`Order #${order.id.slice(0, 8).toUpperCase()}`} />
        <div className="flex flex-wrap items-center gap-2">
          <OrderPrintButton />
          <Link href="/orders" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted/40 print:hidden">
            <ArrowLeft className="h-4 w-4" /> Back to orders
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Order number</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">#{order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <div className="mt-2"><Badge tone={tone} className="px-4 py-1.5 text-sm">{STATUS_LABEL[order.status] ?? order.status}</Badge></div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Order date</p>
                <p className="mt-2 text-base font-bold">{date}</p>
              </div>
            </div>
          </Card>

          <Card title="Ordered items">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="pb-3">Item</th>
                    <th className="pb-3">Qty</th>
                    <th className="pb-3">Modifiers</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.lines.map((line) => (
                    <tr key={line.id} className="align-top">
                      <td className="py-4 font-bold text-primary">{line.name}</td>
                      <td className="py-4 font-semibold">{line.quantity}</td>
                      <td className="py-4 text-xs text-muted-foreground">
                        {line.modifiers_snapshot?.map((m) => m.name).join(", ") || "—"}
                      </td>
                      <td className="py-4 text-right font-semibold">{sym}{(line.line_total_minor / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card title="Customer information">
            <dl className="space-y-3.5 text-sm">
              {[
                ["Customer", order.customer_name],
                ["Phone", order.customer_phone ?? "—"],
                ["Email", order.customer_email ?? "—"],
                ["Service mode", order.service_mode],
                ["Table", order.table_label ?? "—"],
                ["Payment", order.payment_method],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
            <h2 className="text-lg font-bold">Amount summary</h2>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="font-semibold">{sym}{(order.subtotal_minor / 100).toFixed(2)}</span>
              </div>
              {order.discount_minor ? (
                <div className="flex justify-between text-success">
                  <span>Discount</span><span className="font-semibold">-{sym}{(order.discount_minor / 100).toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span><span className="font-semibold">{sym}{(order.delivery_fee_minor / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-success/20 pt-3">
                <span className="text-base font-bold">Total</span>
                <span className="text-2xl font-extrabold text-primary">{sym}{(order.total_minor / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <OrderStatusActions orderId={order.id} restaurantId={restaurantId} currentStatus={order.status} role={role} />
          <OrderRefundCard restaurantId={restaurantId} sym={sym} role={role} initialPayments={payments ?? []} />
        </div>
      </div>
    </div>
  );
}
