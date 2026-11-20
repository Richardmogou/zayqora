import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { PublicContactForm } from "./contact-form";

export default async function StorefrontContactPage({ params }: { params: { slug: string } }) {
  const restaurant = await serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`);
  if (!restaurant) notFound();

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h1 className="text-3xl font-bold text-[#0B2A22]">Contact {restaurant.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reach out for group reservations, allergen inquiries, catering or order support.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-border bg-white p-6 space-y-3 lg:col-span-5">
          <h2 className="text-lg font-bold text-[#0B2A22]">Direct information</h2>
          <p className="text-xs text-slate-700">
            <strong>Address:</strong> {restaurant.address || restaurant.country}
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
            <strong>Timezone:</strong> {restaurant.timezone}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 lg:col-span-7">
          <h2 className="mb-3 text-lg font-bold text-[#0B2A22]">Send an enquiry</h2>
          <PublicContactForm slug={params.slug} />
        </section>
      </div>
    </div>
  );
}
