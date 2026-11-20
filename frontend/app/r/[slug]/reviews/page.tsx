import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { PublicReviewForm } from "./review-form";

interface PublicReviewsOut {
  average_rating: number | null;
  total_reviews: number;
  reviews: {
    id: string;
    customer_name: string;
    rating: number;
    comment: string | null;
    owner_response: string | null;
    created_at: string;
  }[];
}

export default async function StorefrontReviewsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { order?: string };
}) {
  const [restaurant, summary] = await Promise.all([
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
    serverFetch<PublicReviewsOut>(`/public/restaurants/${params.slug}/reviews`),
  ]);
  if (!restaurant) notFound();

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h1 className="text-3xl font-bold text-[#0B2A22]">Guest reviews</h1>
        <p className="mt-1 text-sm text-slate-600">
          {summary && summary.total_reviews > 0 && summary.average_rating
            ? `Average rating: ${summary.average_rating.toFixed(1)} / 5 across ${summary.total_reviews} approved review(s)`
            : `Be the first to share your experience at ${restaurant.name}.`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {!summary || summary.reviews.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-slate-600">
              No published reviews yet.
            </div>
          ) : (
            summary.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#0B2A22]">{review.customer_name}</p>
                  <span className="rounded-full bg-[#E5F1EB] px-2.5 py-0.5 text-xs font-bold text-[#0B2A22]">
                    {review.rating} / 5
                  </span>
                </div>
                {review.comment && <p className="mt-2 text-sm text-slate-700">{review.comment}</p>}
                {review.owner_response && (
                  <div className="mt-3 rounded-xl bg-[#F6F4EF] p-3 text-xs text-[#2F3E39]">
                    <p className="font-semibold text-[#0B2A22]">Response from {restaurant.name}</p>
                    <p className="mt-1">{review.owner_response}</p>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-3 text-lg font-bold text-[#0B2A22]">Leave a review</h2>
            <PublicReviewForm slug={params.slug} defaultOrderId={searchParams.order ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
