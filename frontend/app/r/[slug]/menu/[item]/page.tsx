import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import type { RestaurantInfo } from "@/lib/auth";
import DishCustomizer from "./dish-customizer";

interface PublicModifier { id: string; name: string; price_delta_minor: number; is_default: boolean; }
interface PublicModifierGroup { id: string; name: string; required: boolean; multi_select: boolean; modifiers: PublicModifier[]; }
interface PublicItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_minor: number;
  discounted_price_minor: number | null;
  prep_time_minutes: number | null;
  allergens: string | null;
  dietary_tags: string | null;
  is_featured: boolean;
  is_available: boolean;
  modifier_groups: PublicModifierGroup[];
}
interface PublicCategory { id: string; name: string; items: PublicItem[]; }

export default async function DishDetailPage({ params }: { params: { slug: string; item: string } }) {
  const base = `/r/${params.slug}`;
  const [categories, restaurant] = await Promise.all([
    serverFetch<PublicCategory[]>(`/public/restaurants/${params.slug}/menu`).catch(() => null),
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
  ]);
  if (!categories) notFound();
  const sym = currencySymbol(restaurant?.currency ?? "EUR");
  const dish = categories.flatMap((c) => c.items).find((i) => i.id === params.item);
  if (!dish) notFound();

  const dietaryTags = dish.dietary_tags
    ? dish.dietary_tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <Link href={`${base}/menu`} className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#0B2A22] hover:bg-white">
          ← Back to menu
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-[#E5F1EB] shadow-sm">
            {dish.image_url ? (
              <img src={dish.image_url} alt={dish.name} className="h-64 w-full object-cover sm:h-[360px]" />
            ) : (
              <div className="h-64 w-full sm:h-[360px]" />
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold text-[#0B2A22] sm:text-3xl">{dish.name}</h1>
            {dish.discounted_price_minor != null ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#1D6846]">{sym}{(dish.discounted_price_minor / 100).toFixed(2)}</span>
                <span className="text-base font-medium text-slate-400 line-through">{sym}{(dish.price_minor / 100).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-3xl font-extrabold text-[#C4933F]">{sym}{(dish.price_minor / 100).toFixed(2)}</span>
            )}
          </div>
          {dish.description && <p className="mt-2 text-sm text-slate-600">{dish.description}</p>}
          {(dietaryTags.length > 0 || dish.prep_time_minutes) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {dish.prep_time_minutes && (
                <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#0B2A22]">
                  Prep estimate: ~{dish.prep_time_minutes} min
                </span>
              )}
              {dietaryTags.map((tag) => (
                <span key={tag} className="rounded-lg bg-[#DCF0E5] px-2.5 py-1 text-xs font-semibold text-[#1D6846]">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {dish.allergens && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-bold text-[#0B2A22]">Allergens</p>
              <p className="text-xs text-slate-600">{dish.allergens}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Allergen information is supplied by the restaurant. Please inform staff of any severe food allergies.
              </p>
            </div>
          )}
        </div>

        <DishCustomizer dish={dish} cartHref={`${base}/cart`} slug={params.slug} />
      </div>
    </div>
  );
}
