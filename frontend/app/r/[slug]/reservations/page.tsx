import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth";
import type { RestaurantInfo } from "@/lib/auth";
import { ReservationForm } from "./reservation-form";

export default async function PublicReservationsPage({ params }: { params: { slug: string } }) {
  const restaurant = await serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`);
  if (!restaurant) notFound();
  return <div className="mx-auto max-w-3xl px-5 py-10 md:px-10">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A47732]">{restaurant.name}</p>
    <h1 className="mt-2 font-serif text-4xl font-semibold text-[#0B2A22]">Reserve a table</h1>
    <p className="mt-2 mb-6 text-sm text-slate-600">Choose a date and time, then send a reservation request.</p>
    <ReservationForm slug={params.slug} timeZone={restaurant.timezone} />
  </div>;
}
