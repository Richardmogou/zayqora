import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function StorefrontAboutPage({ params }: { params: { slug: string } }) {
  const restaurant = await serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`);
  if (!restaurant) notFound();
  const base = `/r/${params.slug}`;

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
        {restaurant.cuisine && (
          <span className="inline-block rounded-full bg-[#D5E9DE] px-3 py-1 text-xs font-semibold text-[#0B2A22]">
            {restaurant.cuisine}
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold text-[#0B2A22]">About {restaurant.name}</h1>
        <p className="mt-2 text-base font-medium text-[#2F3E39]">
          {restaurant.tagline || "A culinary experience crafted with seasonal ingredients and warm hospitality."}
        </p>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {restaurant.description ||
            `${restaurant.name} welcomes guests for dine-in service, takeaway and direct online ordering.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`${base}/menu`} className="rounded-xl bg-[#0B2A22] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#163F34]">
            Explore menu
          </Link>
          <Link href={`${base}/reservations`} className="rounded-xl bg-[#D5E9DE] px-5 py-2.5 text-xs font-semibold text-[#0B2A22] hover:bg-[#C3DFD0]">
            Reserve a table
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-bold text-[#0B2A22]">Opening hours ({restaurant.timezone})</h2>
          <dl className="mt-4 divide-y divide-border text-xs">
            {WEEKDAYS.map((day, idx) => {
              const windows = restaurant.reservation_opening_hours?.[String(idx)] ?? [];
              return (
                <div key={day} className="flex items-center justify-between py-2">
                  <dt className="font-semibold text-[#0B2A22]">{day}</dt>
                  <dd className="text-slate-600">
                    {windows.length > 0 ? windows.map(([s, e]) => `${s} – ${e}`).join(" · ") : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 space-y-3">
          <h2 className="text-lg font-bold text-[#0B2A22]">Location &amp; details</h2>
          <p className="text-xs text-slate-700">
            <strong>Address:</strong> {restaurant.address || `${restaurant.country}`}
          </p>
          {restaurant.phone && (
            <p className="text-xs text-slate-700">
              <strong>Phone:</strong> {restaurant.phone}
            </p>
          )}
          {restaurant.contact_email && (
            <p className="text-xs text-slate-700">
              <strong>Email:</strong> {restaurant.contact_email}
            </p>
          )}
          <p className="text-xs text-slate-700">
            <strong>Currency:</strong> {restaurant.currency}
          </p>
          <Link href={`${base}/contact`} className="inline-block pt-2 text-xs font-semibold text-[#0B2A22] underline">
            Send us a message
          </Link>
        </section>
      </div>
    </div>
  );
}
