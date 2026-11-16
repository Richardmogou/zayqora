import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getL } from "@/lib/i18n/server";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const L = getL();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-20 h-[10.5vh] min-h-[64px] shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1520px] items-center justify-between px-6 lg:px-12">
          <Link
            href="/"
            className="font-serif text-[30px] font-normal tracking-[0.04em] text-foreground"
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

          <div className="flex items-center gap-2.5">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full border border-[#B8C9C0] bg-[#E8EFEA] px-5 py-2 text-sm font-medium text-[#0B2A22] transition hover:bg-[#DCE8E0]"
            >
              {L("Sign in", "Se connecter")}
            </Link>
            <Link
              href="/dashboard"
              className="hidden rounded-full bg-gold px-5 py-2 text-sm font-medium text-[#0B2A22] transition hover:opacity-90 sm:inline-block"
            >
              {L("Create my restaurant", "Créer mon restaurant")}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
