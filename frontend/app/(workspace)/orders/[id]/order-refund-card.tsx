"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Printer, RotateCcw } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export interface PaymentTxItem {
  id: string;
  provider: string;
  provider_reference: string;
  amount_minor: number;
  refunded_amount_minor: number;
  currency: string;
  status: string;
}

const PAY_TONE: Record<string, Tone> = {
  paid: "success",
  pending: "warning",
  partially_refunded: "warning",
  refunded: "info",
  failed: "danger",
};

export function OrderPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted/40 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print receipt / ticket
    </button>
  );
}

export function OrderRefundCard({
  restaurantId,
  sym,
  role,
  initialPayments,
}: {
  restaurantId: string;
  sym: string;
  role: string;
  initialPayments: PaymentTxItem[];
}) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentTxItem[]>(initialPayments);
  const [reason, setReason] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canRefund = role === "owner" || role === "manager" || role === "cashier";

  async function handleRefund(e: FormEvent, payment: PaymentTxItem) {
    e.preventDefault();
    if (!canRefund || !reason.trim()) return;
    setBusyId(payment.id);
    setError("");
    setNotice("");
    try {
      const parsed = amountInput.trim() ? Math.round(Number.parseFloat(amountInput) * 100) : null;
      await api(`/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          amount_minor: parsed && parsed > 0 ? parsed : null,
          reason: reason.trim(),
        }),
      });
      const refreshed = await api<PaymentTxItem[]>(`/payments?order_id=${payment.id ? "" : ""}`, {
        headers: { "X-Restaurant-Id": restaurantId },
      }).catch(() => null);
      if (refreshed) {
        setPayments((prev) =>
          prev.map((p) => refreshed.find((r) => r.id === p.id) ?? p)
        );
      }
      setReason("");
      setAmountInput("");
      setNotice("Refund recorded and audited.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process refund.");
    } finally {
      setBusyId(null);
    }
  }

  if (payments.length === 0) return null;

  return (
    <Card title="Payments & refunds">
      <div className="space-y-4">
        {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
        {notice && <p role="status" className="text-xs font-semibold text-success">{notice}</p>}
        {payments.map((payment) => {
          const remaining = Math.max(0, payment.amount_minor - payment.refunded_amount_minor);
          const refundable = canRefund && remaining > 0 && ["paid", "partially_refunded"].includes(payment.status);
          return (
            <div key={payment.id} className="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold">{payment.provider_reference}</span>
                <Badge tone={PAY_TONE[payment.status] ?? "neutral"}>{payment.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-muted-foreground">
                Amount: <strong>{sym}{(payment.amount_minor / 100).toFixed(2)}</strong> · Refunded:{" "}
                <strong>{sym}{(payment.refunded_amount_minor / 100).toFixed(2)}</strong>
              </p>
              {refundable && (
                <form onSubmit={(e) => void handleRefund(e, payment)} className="space-y-2 pt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(remaining / 100).toFixed(2)}
                    placeholder={`Amount (leave empty for full ${sym}${(remaining / 100).toFixed(2)})`}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                  />
                  <input
                    required
                    minLength={2}
                    placeholder="Refund reason (required) *"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busyId === payment.id}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-danger/15 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {busyId === payment.id ? "Refunding…" : "Issue refund"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
