import Link from "next/link";
import { serverFetch } from "@/lib/auth";
import type { RestaurantInfo } from "@/lib/auth";

const NAV = [
  { label: "Home",         href: "" },
  { label: "Menu",         href: "/menu" },
  { label: "Cart",         href: "/cart" },
  { label: "Book a Table", href: "/reservations" },
];

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const base = `/r/${params.slug}`;
  const restaurant = await serverFetch<RestaurantInfo>(`/public/restaurants/${params.slug}`);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F6F4EF] text-[#0B2A22]">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="relative flex h-full w-60 shrink-0 flex-col justify-between overflow-hidden bg-[#0B2A22] px-5 py-6 text-white">
            <div className="relative z-10">
              <div className="flex justify-center pb-7">
                <Link href={base} className="flex flex-col items-center">
                  <img src="/images/logo-emblem.png" alt="" className="h-10 w-10 object-contain" />
                  <span className="mt-1.5 font-serif text-2xl tracking-[0.08em] text-[#C4933F]">
                    {restaurant?.name ?? "ZAYQORA"}
                  </span>
                  <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-[#C4933F]/80">RESTAURANT</span>
                </Link>
              </div>
              <nav className="space-y-1.5">
                {NAV.map((item) => (
                  <Link
                    key={item.label}
                    href={`${base}${item.href}`}
                    className="block rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 px-2 opacity-30">
              <img src="/images/sidebar-arch.png" alt="" className="w-full object-contain" />
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>

        <footer id="contact" className="shrink-0 border-t border-white/10 bg-[#071E17] px-8 py-3.5 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <span className="font-serif text-xl tracking-[0.14em] text-[#C4933F]">
              {restaurant?.name ?? "ZAYQORA"}
            </span>
            <div className="flex items-center gap-8 text-xs font-medium text-white/80">
              <Link href={`${base}#contact`} className="hover:text-[#C4933F]">Contact</Link>
              <Link href={`${base}/menu`} className="hover:text-[#C4933F]">Menu</Link>
            </div>
          </div>
        </footer>
      </div>
  );
}
