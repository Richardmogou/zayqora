"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "verified" | "error">(token ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        if (!cancelled) setStatus("verified");
      })
      .catch((caught) => {
        if (!cancelled) {
          setStatus("error");
          setError(caught instanceof Error ? caught.message : "Verification link is invalid or expired.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying your email address…
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="space-y-4">
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>Your email address has been verified.</p>
        </div>
        <Link
          href="/dashboard"
          className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Go to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p>{error ?? "No verification token was provided in this link."}</p>
      </div>
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1.5">
          <Link href="/" className="font-serif text-xl tracking-[0.14em] text-primary">
            ZAYQORA
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Email verification</h1>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
