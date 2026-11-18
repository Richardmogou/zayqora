import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getL } from "@/lib/i18n/server";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const L = getL();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <header className="relative z-20 min-h-[64px] shrink-0 border-b border-border bg-background/95 backdrop-blur lg:h-[10.5vh]">
        <div className="mx-auto flex h-16 max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:h-full lg:px-12">
          <Link
            href="/"
            className="font-serif text-2xl font-normal tracking-[0.04em] text-foreground sm:text-[30px]"
          >
            ZAYQORA
          </Link>

          <nav className="hidden items-center gap-10 text-[15px] font-medium md:flex">
            <Link href="/" className="text-gold">
              {L("Home", "Accueil")}
            </Link>
            <Link href="/dashboard" className="text-foreground hover:text-gold">
              {L("Features", "Fonctionnalités")}
            </Link>
            <Link href="/login" className="text-foreground hover:text-gold">
              {L("Pricing", "Tarifs")}
            </Link>
            <Link href="/login" className="text-foreground hover:text-gold">
              {L("Contact", "Contact")}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full border border-[#B8C9C0] bg-[#E8EFEA] px-3.5 py-1.5 text-xs font-medium text-[#0B2A22] transition hover:bg-[#DCE8E0] sm:px-5 sm:py-2 sm:text-sm"
            >
              {L("Sign in", "Se connecter")}
            </Link>
            <Link
              href="/register"
              className="hidden rounded-full bg-gold px-5 py-2 text-sm font-medium text-[#0B2A22] transition hover:opacity-90 sm:inline-block"
            >
              {L("Create my restaurant", "Créer mon restaurant")}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">{children}</main>
    </div>
  );
}
