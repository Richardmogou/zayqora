"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <aside className="relative hidden w-64 shrink-0 flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground md:flex">
      <div className="relative z-10 px-5 pt-7 pb-4 text-center">
        <Link href="/dashboard" className="inline-flex flex-col items-center">
          <img
            src="/images/logo-emblem.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 object-contain"
          />
          <span className="mt-1.5 font-serif text-2xl tracking-[0.08em] text-gold">
            ZAYQORA
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-gold/85">
            {restaurantName || "RESTAURANT"}
          </span>
        </Link>
      </div>

      <nav className="relative z-10 flex flex-1 flex-col gap-1 px-4" aria-label={t("common.mainNav")}>
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-active/60",
                active ? "bg-sidebar-active text-gold" : "text-sidebar-foreground/90"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-gold" : "text-sidebar-foreground/80")} />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pointer-events-none relative z-0 px-2 pt-4">
        <img
          src="/images/sidebar-arch.png"
          alt=""
          aria-hidden="true"
          className="w-full object-contain opacity-90"
        />
      </div>

      <p className="relative z-10 border-t border-white/10 px-5 py-3 text-center text-[11px] text-sidebar-foreground/60">
        ZAYQORA · A VIRELEO project
      </p>
    </aside>
  );
}
