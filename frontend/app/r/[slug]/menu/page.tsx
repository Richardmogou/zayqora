import { notFound } from "next/navigation";
import { serverFetch, type RestaurantInfo } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency-context";
import { MenuBrowser, type PublicCategory } from "./menu-browser";

export default async function StorefrontMenuPage({ params }: { params: { slug: string } }) {
  const base = `/r/${params.slug}`;
  const [categoriesResult, restaurant] = await Promise.all([
    serverFetch<PublicCategory[]>(`/public/restaurants/${params.slug}/menu`),
    serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`),
  ]);
  if (!restaurant) notFound();
  const categories = categoriesResult ?? [];
  const sym = currencySymbol(restaurant.currency);

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden border-b border-border/60 bg-[#F6F4EF] px-8 py-8">
        <img src="/images/p12-header-fade.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[65%] object-cover object-left" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-5xl font-bold text-[#0B2A22]">Our menu</h1>
            <p className="mt-2 text-lg font-medium text-[#0B2A22]/90">Authentic flavors for every palate</p>
          </div>
          <div className="border-l-2 border-[#C4933F]/50 pl-6">
            <p className="text-xl font-bold leading-snug text-[#0B2A22]">
              More than
              <br />
              a meal,
              <br />
              an experience
            </p>
            <span className="mt-2 block h-0.5 w-10 bg-[#C4933F]" />
          </div>
        </div>
      </section>

      <MenuBrowser base={base} sym={sym} categories={categories} />
    </div>
  );
}
