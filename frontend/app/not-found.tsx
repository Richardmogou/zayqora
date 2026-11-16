import Link from "next/link";
import { btn } from "@/components/ui/styles";
import { getL } from "@/lib/i18n/server";

export default function NotFound() {
  const L = getL();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{L("Page not found", "Page introuvable")}</h1>
      <Link href="/" className={btn.primary}>{L("Back to home", "Retour à l'accueil")}</Link>
    </main>
  );
}
