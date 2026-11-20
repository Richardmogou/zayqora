import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";

interface PublicOffer {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_minor: number;
  expires_at: string | null;
}

export default async function StorefrontOffersPage({ params }: { params: { slug: string } }) {
  const [restaurant, offers] = await Promise.all([
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
    serverFetch<PublicOffer[]>(`/public/restaurants/${params.slug}/offers`),
  ]);
  if (!restaurant) notFound();
  const sym = currencySymbol(restaurant.currency);
  const base = `/r/${params.slug}`;

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h1 className="text-3xl font-bold text-[#0B2A22]">Offers &amp; promotions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Apply any active promo code in your cart before checkout at {restaurant.name}.
        </p>
      </div>

      {!offers || offers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-slate-600">
          No active promo codes right now. Check back soon or{" "}
          <Link href={`${base}/menu`} className="font-semibold text-[#0B2A22] underline">
            browse the menu
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const benefit =
              offer.discount_type === "percentage"
                ? `${offer.discount_value}% off`
                : offer.discount_type === "free_delivery"
                  ? "Free delivery"
                  : `${sym}${(offer.discount_value / 100).toFixed(2)} off`;
            return (
              <article key={offer.id} className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5">
                <div>
                  <span className="inline-block rounded-lg bg-[#E5F1EB] px-3 py-1 font-mono text-sm font-bold text-[#0B2A22]">
                    {offer.code}
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-[#0B2A22]">{benefit}</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {offer.min_order_minor > 0
                      ? `Minimum order: ${sym}${(offer.min_order_minor / 100).toFixed(2)}`
                      : "No minimum order required"}
                  </p>
                  {offer.expires_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Valid until {new Date(offer.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Link
                  href={`${base}/menu`}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#0B2A22] text-xs font-semibold text-white hover:bg-[#163F34]"
                >
                  Order now
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
