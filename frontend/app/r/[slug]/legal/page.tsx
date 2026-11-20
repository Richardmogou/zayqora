import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";

export default async function StorefrontLegalPage({ params }: { params: { slug: string } }) {
  const restaurant = await serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`);
  if (!restaurant) notFound();

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h1 className="text-3xl font-bold text-[#0B2A22]">Legal &amp; policies</h1>
        <p className="mt-1 text-sm text-slate-600">{restaurant.name} — Privacy, terms and cancellation policies</p>
      </div>

      <section className="rounded-2xl border border-border bg-white p-6 space-y-2">
        <h2 className="text-lg font-bold text-[#0B2A22]">Privacy policy</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {restaurant.privacy_policy ||
            `${restaurant.name} collects only the contact and fulfilment details required to process your orders and table reservations. Contact ${restaurant.contact_email || "the restaurant"} for data access or deletion requests.`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 space-y-2">
        <h2 className="text-lg font-bold text-[#0B2A22]">Terms of service &amp; allergen notice</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {restaurant.terms_of_service ||
            `Menu prices, availability and allergen descriptions are maintained directly by ${restaurant.name}. Guests with severe allergies should contact the restaurant before ordering.`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 space-y-2">
        <h2 className="text-lg font-bold text-[#0B2A22]">Refund &amp; cancellation policy</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {restaurant.refund_policy ||
            "Online orders may be cancelled before kitchen preparation begins. Eligible refunds are processed back to the original payment method after verification."}
        </p>
      </section>
    </div>
  );
}
