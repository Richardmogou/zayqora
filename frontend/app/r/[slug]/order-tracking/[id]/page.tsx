import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { OrderTrackingClient, type TrackedOrderDetail } from "./order-tracking-client";

export default async function OrderTrackingPage({ params }: { params: { slug: string; id: string } }) {
  const [restaurant, order] = await Promise.all([
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
    serverFetch<TrackedOrderDetail>(`/public/orders/${params.id}?slug=${encodeURIComponent(params.slug)}`),
  ]);
  if (!restaurant || !order) notFound();

  const sym = currencySymbol(restaurant.currency);
  return <OrderTrackingClient slug={params.slug} sym={sym} initialOrder={order} />;
}
