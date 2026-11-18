import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";

interface PublicItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_minor: number;
  discounted_price_minor: number | null;
  is_featured: boolean;
}

interface PublicCategory {
  id: string;
  name: string;
  items: PublicItem[];
}

const DISH_IMAGES = [
  "/images/dish-salad-native.png",
  "/images/dish-salmon-native.png",
  "/images/dish-tart-native.png",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatOpeningHours(hours?: Record<string, [string, string][]> | null): string {
  if (!hours) return "Tue – Sun: 12:00 – 14:30 · 19:00 – 22:00";
  const entries = WEEKDAYS.map((day, idx) => {
    const windows = hours[String(idx)] ?? [];
    if (windows.length === 0) return null;
    return `${day}: ${windows.map(([start, end]) => `${start}–${end}`).join(", ")}`;
  }).filter(Boolean);
  return entries.length > 0 ? entries.slice(0, 3).join(" · ") : "By reservation";
}

export default async function StorefrontHomePage({ params }: { params: { slug: string } }) {
  const base = `/r/${params.slug}`;
  const [restaurant, categories] = await Promise.all([
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
    serverFetch<PublicCategory[]>(`/public/restaurants/${params.slug}/menu`),
  ]);
  if (!restaurant) notFound();

  const sym = currencySymbol(restaurant.currency);
  const allDishes = (categories ?? []).flatMap((cat) => cat.items);
  const featuredDishes = [...allDishes]
    .sort((a, b) => (a.is_featured === b.is_featured ? 0 : a.is_featured ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="flex h-full flex-col justify-between pb-6">
      <section className="relative flex min-h-[280px] flex-1 items-center overflow-hidden bg-[#F6F4EF]">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-35 lg:w-[58%] lg:opacity-100">
          <img src="/images/p11-hero-fade.png" alt="" className="h-full w-full object-cover object-left" />
        </div>
        <div className="relative z-10 flex items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-4">
          <div className="max-w-lg">
            <h1 className="text-3xl font-bold leading-none tracking-wide text-[#0B2A22] sm:text-4xl xl:text-[50px]">{restaurant.name}</h1>
            <h2 className="mt-2 text-xl font-bold leading-[1.15] text-[#0B2A22] sm:text-2xl xl:text-[32px]">
              A culinary experience
              <br />
              that brings people together
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#2F3E39]">
              Authentic flavors, quality ingredients, and a warm atmosphere to share unforgettable moments.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`${base}/menu`} className="rounded-xl bg-[#0B2A22] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#163F34]">
                View menu
              </Link>
              <Link href={`${base}/reservations`} className="rounded-xl bg-[#D5E9DE] px-6 py-2.5 text-sm font-semibold text-[#0B2A22] transition hover:bg-[#C3DFD0]">
                Book a table
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 lg:px-8 lg:py-3">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h3 className="mb-2.5 text-xl font-bold text-[#0B2A22]">Popular dishes</h3>
            {featuredDishes.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-sm text-slate-600">
                Browse our full menu to discover available dishes.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {featuredDishes.map((dish, idx) => (
                  <Link key={dish.id} href={`${base}/menu/${dish.id}`} className="group block">
                    <div className="overflow-hidden rounded-2xl">
                      <img
                        src={dish.image_url || DISH_IMAGES[idx % DISH_IMAGES.length]}
                        alt={dish.name}
                        className="h-32 w-full object-cover transition duration-300 group-hover:scale-105 xl:h-36"
                      />
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-[#0B2A22] group-hover:text-[#C4933F]">{dish.name}</p>
                      <span className="text-xs font-bold text-[#C4933F]">
                        {sym}
                        {((dish.discounted_price_minor ?? dish.price_minor) / 100).toFixed(2)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div id="reserve" className="lg:col-span-4">
            <div className="h-full rounded-2xl bg-[#E5F1EB] p-5">
              <h3 className="text-lg font-bold text-[#0B2A22]">Hours &amp; location</h3>
              <div className="mt-3 space-y-2.5 text-xs text-[#0B2A22]">
                <div>
                  <p className="font-semibold">Opening hours ({restaurant.timezone}):</p>
                  <p className="text-slate-600">{formatOpeningHours(restaurant.reservation_opening_hours)}</p>
                </div>
                <div>
                  <p className="font-semibold">Country &amp; currency:</p>
                  <p className="text-slate-600">
                    {restaurant.country} · {restaurant.currency}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Online services:</p>
                  <p className="text-slate-600">Dine-in, Takeaway, Delivery &amp; Table Reservations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#E2EFE8] px-5 py-4 sm:px-7">
          <div>
            <h3 className="text-xl font-bold text-[#0B2A22]">Order online</h3>
            <p className="mt-0.5 text-xs text-[#42524C]">Enjoy your favorite dishes wherever you are.</p>
          </div>
          <Link href={`${base}/menu`} className="rounded-xl bg-[#0B2A22] px-7 py-2.5 text-xs font-semibold text-white transition hover:bg-[#163F34]">
            Order
          </Link>
        </div>
      </section>
    </div>
  );
}
