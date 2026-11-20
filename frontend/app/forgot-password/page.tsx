"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await api<{ status: string; reset_token?: string | null }>("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      setDevToken(res.reset_token ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request password reset.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1.5">
          <Link href="/" className="font-serif text-xl tracking-[0.14em] text-primary">
            ZAYQORA
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your account email and we will send a password reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div role="status" className="flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p>If an active account exists for that email, a reset link has been sent.</p>
            </div>
            {devToken && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <p className="font-semibold">Development reset link:</p>
                <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`} className="mt-1 block break-all text-primary underline">
                  Open password reset form
                </Link>
              </div>
            )}
            <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>

            <Link href="/login" className="block text-center text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
