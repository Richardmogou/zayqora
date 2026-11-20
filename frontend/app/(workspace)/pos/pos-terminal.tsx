"use client";

import { useState, type FormEvent } from "react";
import { Banknote, CheckCircle2, CreditCard, Minus, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export interface PosMenuItem {
  id: string;
  category_id: string | null;
  name: string;
  price_minor: number;
  discounted_price_minor: number | null;
  is_available: boolean;
  is_published: boolean;
}

export interface PosCategory {
  id: string;
  name: string;
}

export interface CashSessionItem {
  id: string;
  opening_balance_minor: number;
  expected_cash_minor: number;
  counted_cash_minor: number | null;
  variance_minor: number | null;
  status: string;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

type CartLine = { item: PosMenuItem; quantity: number };

export function PosTerminal({
  restaurantId,
  sym,
  role,
  categories,
  items,
  tables,
  initialSessions,
}: {
  restaurantId: string;
  sym: string;
  role: string;
  categories: PosCategory[];
  items: PosMenuItem[];
  tables: string[];
  initialSessions: CashSessionItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [serviceMode, setServiceMode] = useState<"dine-in" | "pickup" | "delivery">("dine-in");
  const [tableLabel, setTableLabel] = useState(tables[0] ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "paypal">("cash");
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<CashSessionItem[]>(initialSessions);
  const [openingCash, setOpeningCash] = useState("100.00");
  const [countedCash, setCountedCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canManageCash = role === "owner" || role === "manager" || role === "cashier";
  const openSession = sessions.find((s) => s.status === "open") ?? null;

  const availableItems = items.filter(
    (item) =>
      item.is_available &&
      item.is_published &&
      (selectedCategory === "ALL" || item.category_id === selectedCategory)
  );

  function addItem(item: PosMenuItem) {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  const totalMinor = cart.reduce(
    (sum, line) => sum + (line.item.discounted_price_minor ?? line.item.price_minor) * line.quantity,
    0
  );

  async function refreshSessions() {
    if (!canManageCash) return;
    try {
      const list = await api<CashSessionItem[]>("/pos/sessions", {
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setSessions(list);
    } catch {}
  }

  async function handleSubmitOrder(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api<{ id: string; total_minor: number }>("/pos/orders", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          customer_name: customerName.trim() || "Walk-in Guest",
          service_mode: serviceMode,
          table_label: serviceMode === "dine-in" ? tableLabel || null : null,
          payment_method: paymentMethod,
          mark_paid: true,
          special_instructions: notes.trim() || null,
          lines: cart.map((line) => ({ menu_item_id: line.item.id, quantity: line.quantity, modifier_ids: [] })),
        }),
      });
      setCart([]);
      setNotes("");
      setNotice(
        `Order #${created.id.slice(0, 8).toUpperCase()} sent to kitchen (${sym}${(created.total_minor / 100).toFixed(2)}).`
      );
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit POS order.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenSession(e: FormEvent) {
    e.preventDefault();
    if (!canManageCash) return;
    setBusy(true);
    setError("");
    try {
      const openingMinor = Math.max(0, Math.round((Number.parseFloat(openingCash) || 0) * 100));
      await api<CashSessionItem>("/pos/sessions/open", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ opening_balance_minor: openingMinor }),
      });
      setNotice("Cash drawer session opened.");
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open cash session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseSession(e: FormEvent) {
    e.preventDefault();
    if (!canManageCash || !openSession) return;
    setBusy(true);
    setError("");
    try {
      const countedMinor = Math.max(0, Math.round((Number.parseFloat(countedCash) || 0) * 100));
      const closed = await api<CashSessionItem>(`/pos/sessions/${openSession.id}/close`, {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ counted_cash_minor: countedMinor }),
      });
      setCountedCash("");
      setNotice(
        `Cash session closed. Variance: ${sym}${((closed.variance_minor ?? 0) / 100).toFixed(2)}.`
      );
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close cash session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                selectedCategory === "ALL" ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"
              }`}
            >
              All dishes
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                  selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableItems.map((item) => {
              const price = item.discounted_price_minor ?? item.price_minor;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                >
                  <p className="text-sm font-bold">{item.name}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-primary">
                      {sym}{(price / 100).toFixed(2)}
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
            {availableItems.length === 0 && (
              <Card className="sm:col-span-2 xl:col-span-3">
                <p className="py-8 text-center text-sm text-muted-foreground">No available menu items in this category.</p>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card title="Current ticket">
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Guest / label</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Service mode</label>
                  <select
                    value={serviceMode}
                    onChange={(e) => setServiceMode(e.target.value as "dine-in" | "pickup" | "delivery")}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                  >
                    <option value="dine-in">Dine-in</option>
                    <option value="pickup">Counter / Takeaway</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
              </div>

              {serviceMode === "dine-in" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">Table</label>
                  {tables.length > 0 ? (
                    <select
                      value={tableLabel}
                      onChange={(e) => setTableLabel(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                    >
                      <option value="">No table</option>
                      {tables.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={tableLabel}
                      onChange={(e) => setTableLabel(e.target.value)}
                      placeholder="Table 1…"
                      className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
                    />
                  )}
                </div>
              )}

              <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 px-3">
                {cart.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Tap menu items to build an order.</p>
                ) : (
                  cart.map((line) => {
                    const unit = line.item.discounted_price_minor ?? line.item.price_minor;
                    return (
                      <div key={line.item.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{line.item.name}</p>
                          <p className="text-muted-foreground">{sym}{((unit * line.quantity) / 100).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => updateQty(line.item.id, -1)} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card hover:bg-muted">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center font-bold">{line.quantity}</span>
                          <button type="button" onClick={() => updateQty(line.item.id, 1)} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card hover:bg-muted">
                            <Plus className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => updateQty(line.item.id, -line.quantity)} className="p-1 text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kitchen notes / allergy warning…"
                className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs"
              />

              <div className="grid grid-cols-3 gap-2">
                {([
                  ["cash", Banknote, "Cash"],
                  ["card", CreditCard, "Card"],
                  ["paypal", Wallet, "PayPal"],
                ] as const).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentMethod(key)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold ${
                      paymentMethod === key ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-xl font-extrabold text-primary">{sym}{(totalMinor / 100).toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={busy || cart.length === 0}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" /> {busy ? "Submitting…" : "Settle & send to kitchen"}
              </button>
            </form>
          </Card>

          {canManageCash && (
            <Card title="Cash drawer session">
              {openSession ? (
                <form onSubmit={handleCloseSession} className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge tone="success">Session open</Badge>
                    <span className="text-muted-foreground">
                      Opened {new Date(openSession.opened_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3">
                    <div>
                      <p className="text-muted-foreground">Opening float</p>
                      <p className="font-bold">{sym}{(openSession.opening_balance_minor / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected cash</p>
                      <p className="font-bold text-primary">{sym}{(openSession.expected_cash_minor / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Counted cash amount"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Close drawer
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleOpenSession} className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="Opening float"
                    className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Open cash drawer
                  </button>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
