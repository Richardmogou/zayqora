"use client";
import { AlertCircle, Building2, Loader2, Lock, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: String(form.get("full_name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          restaurant_name: String(form.get("restaurant_name") ?? "").trim(),
        }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : 0;
      setError(
        status === 409
          ? t("auth.emailTaken")
          : status === 429
          ? t("auth.tooMany")
          : t("auth.registerUnavailable")
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /> {error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">{t("auth.fullName")}</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input id="full_name" name="full_name" type="text" autoComplete="name" required minLength={2} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">{t("auth.email")}</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">{t("auth.password")}</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="restaurant_name" className="text-sm font-medium">{t("auth.restaurantName")}</label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input id="restaurant_name" name="restaurant_name" type="text" required minLength={2} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? t("auth.registering") : t("auth.register")}
      </button>
    </form>
  );
}
