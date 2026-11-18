import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect("/dashboard");
  const t = getT();

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex items-center gap-3">
          <img src="/images/logo-emblem.png" alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
          <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-gold">ZAYQORA</Link>
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-4xl font-bold leading-tight text-white">{t("brand.tagline")}</h2>
          <p className="text-sm text-sidebar-foreground/80">
            Create your restaurant workspace and start managing your business in minutes.
          </p>
        </div>

        <img
          src="/images/sidebar-arch.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 w-80 -translate-x-1/2 object-contain opacity-45"
        />
        <p className="relative z-10 text-xs text-sidebar-foreground/70">A VIRELEO project</p>
      </aside>

      <section className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <LocaleSwitcher /><ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <Link href="/" className="font-serif text-xl tracking-[0.14em] text-primary lg:hidden">ZAYQORA</Link>
            <h1 className="text-3xl font-semibold tracking-tight">{t("auth.register")}</h1>
            <p className="text-muted-foreground">{t("auth.restaurantName")}</p>
          </div>

          <RegisterForm />

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
          <Link href="/" className="block text-center text-sm text-primary hover:underline">{t("auth.backHome")}</Link>
        </div>
      </section>
    </main>
  );
}
