"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { currencySymbol } from "@/lib/currency-context";

export interface DailySalesPoint {
  date: string;
  label: string;
  orders_count: number;
  gross_sales_minor: number;
}

export interface TopItem {
  name: string;
  quantity: number;
  revenue_minor: number;
}

export interface BreakdownItem {
  key: string;
  count: number;
  total_minor: number;
}

export interface SalesReport {
  period: string;
  start_date?: string | null;
  end_date?: string | null;
  currency: string;
  timezone: string;
  orders_count: number;
  cancelled_orders_count: number;
  gross_sales_minor: number;
  discounts_minor?: number;
  refunds_minor?: number;
  expenses_minor?: number;
  net_sales_minor: number;
  estimated_profit_minor?: number;
  delivery_fees_minor: number;
  estimated_tax_minor: number;
  cancelled_minor: number;
  average_order_value_minor: number;
  covers_served: number;
  daily_series: DailySalesPoint[];
  top_items: TopItem[];
  by_payment_method: BreakdownItem[];
  by_service_mode: BreakdownItem[];
}

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount_minor: number;
  incurred_on: string;
}

export function ReportsView({
  restaurantId,
  initialReport,
}: {
  restaurantId: string;
  initialReport: SalesReport | null;
}) {
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [startDate, setStartDate] = useState(initialReport?.start_date ?? "");
  const [endDate, setEndDate] = useState(initialReport?.end_date ?? "");
  const [report, setReport] = useState<SalesReport | null>(initialReport);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expCategory, setExpCategory] = useState("Ingredients");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom" && startDate && endDate) {
      params.set("start_date", startDate);
      params.set("end_date", endDate);
    }
    return params.toString();
  }, [endDate, period, startDate]);

  const loadAll = useCallback(async () => {
    if (period === "custom" && (!startDate || !endDate)) return;
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const [rep, expList] = await Promise.all([
        api<SalesReport>(`/reports/sales?${qs}`, { headers: { "X-Restaurant-Id": restaurantId } }),
        api<ExpenseRow[]>("/expenses", { headers: { "X-Restaurant-Id": restaurantId } }).catch(() => []),
      ]);
      setReport(rep);
      setExpenses(expList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sales report.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, endDate, period, restaurantId, startDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleExportCsv() {
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/sales/export?${buildQuery()}`, {
        credentials: "include",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      if (!res.ok) throw new Error("Could not export sales report.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed.");
    }
  }

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    const amountMinor = Math.round((Number.parseFloat(expAmount) || 0) * 100);
    if (!expDesc.trim() || amountMinor <= 0) return;
    setError(null);
    try {
      await api("/expenses", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          category: expCategory,
          description: expDesc.trim(),
          amount_minor: amountMinor,
          incurred_on: expDate,
        }),
      });
      setExpDesc("");
      setExpAmount("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record expense.");
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    try {
      await api(`/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete expense.");
    }
  }

  const sym = currencySymbol(report?.currency ?? "EUR");
  const fmt = (minor: number) => `${sym}${(minor / 100).toFixed(2)}`;

  const kpis = [
    {
      label: "Gross sales",
      value: fmt(report?.gross_sales_minor ?? 0),
      sub: `Net: ${fmt(report?.net_sales_minor ?? 0)} · Discounts: ${fmt(report?.discounts_minor ?? 0)}`,
      bgClass: "bg-[#EAF4EE] border-[#D3E7DC]",
      labelClass: "text-[#0B2A22]",
    },
    {
      label: "Completed orders",
      value: String(report?.orders_count ?? 0),
      sub: `${report?.covers_served ?? 0} covers · Avg ${fmt(report?.average_order_value_minor ?? 0)}`,
      bgClass: "bg-[#FBF5E8] border-[#EFE2C6]",
      labelClass: "text-slate-600",
    },
    {
      label: "Expenses",
      value: fmt(report?.expenses_minor ?? 0),
      sub: `Est. profit: ${fmt(report?.estimated_profit_minor ?? 0)}`,
      bgClass: "bg-[#EBF3FA] border-[#D4E4F4]",
      labelClass: "text-slate-600",
    },
    {
      label: "Refunds & Cancelled",
      value: fmt((report?.refunds_minor ?? 0) + (report?.cancelled_minor ?? 0)),
      sub: `Refunds ${fmt(report?.refunds_minor ?? 0)} · ${report?.cancelled_orders_count ?? 0} cancelled`,
      bgClass: "bg-[#FAF0EE] border-[#F2D6D2]",
      labelClass: "text-[#B4322A]",
    },
    {
      label: "Estimated taxes",
      value: fmt(report?.estimated_tax_minor ?? 0),
      sub: `Delivery fees ${fmt(report?.delivery_fees_minor ?? 0)}`,
      bgClass: "bg-[#F3EFFA] border-[#E2D6F5]",
      labelClass: "text-[#0B2A22]",
    },
  ];

  const series = report?.daily_series ?? [];
  const maxSales = Math.max(...series.map((p) => p.gross_sales_minor), 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & finance reports"
        description="Analyze revenue, discounts, refunds, expenses and estimated profit"
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "today" | "7d" | "30d" | "custom")}
              className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
            {period === "custom" && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold hover:bg-muted"
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-5 ${kpi.bgClass}`}>
            <p className={`text-xs font-semibold ${kpi.labelClass}`}>{kpi.label}</p>
            <p className="mt-2.5 text-2xl font-extrabold text-[#0B2A22] sm:text-3xl">{kpi.value}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-600">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card title="Sales evolution" className="lg:col-span-7">
          {loading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading chart...</p>
          ) : (
            <>
              <div className="mt-4 flex h-64 items-end gap-3 border-b border-border pb-2 pt-6">
                {series.slice(-14).map((bar) => {
                  const pct = Math.max(bar.gross_sales_minor > 0 ? Math.round((bar.gross_sales_minor / maxSales) * 100) : 4, 4);
                  return (
                    <div key={bar.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {bar.gross_sales_minor > 0 ? fmt(bar.gross_sales_minor) : ""}
                      </span>
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full max-w-[42px] rounded-t-lg bg-[#6FA68B] transition hover:bg-primary"
                        title={`${bar.date}: ${fmt(bar.gross_sales_minor)} (${bar.orders_count} orders)`}
                      />
                    </div>
                  );
                })}
              </div>
              <div
                className="mt-2 grid text-center text-[11px] font-medium text-muted-foreground"
                style={{ gridTemplateColumns: `repeat(${Math.max(series.slice(-14).length, 1)}, minmax(0, 1fr))` }}
              >
                {series.slice(-14).map((bar) => (
                  <span key={bar.date}>{bar.label}</span>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Top selling dishes" className="lg:col-span-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="pb-3">Dish</th>
                  <th className="pb-3 text-center">Qty</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(report?.top_items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                      No item sales recorded in this period.
                    </td>
                  </tr>
                )}
                {(report?.top_items ?? []).map((prod) => (
                  <tr key={prod.name}>
                    <td className="py-3.5 font-medium text-primary">{prod.name}</td>
                    <td className="py-3.5 text-center font-semibold">{prod.quantity}</td>
                    <td className="py-3.5 text-right font-semibold">{fmt(prod.revenue_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Revenue by service mode">
          <div className="divide-y divide-border text-sm">
            {(report?.by_service_mode ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No orders in selected period.</p>
            )}
            {(report?.by_service_mode ?? []).map((row) => (
              <div key={row.key} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold capitalize">{row.key}</p>
                  <p className="text-xs text-muted-foreground">{row.count} order(s)</p>
                </div>
                <span className="font-bold text-primary">{fmt(row.total_minor)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Revenue by payment method">
          <div className="divide-y divide-border text-sm">
            {(report?.by_payment_method ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No payments in selected period.</p>
            )}
            {(report?.by_payment_method ?? []).map((row) => (
              <div key={row.key} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold capitalize">{row.key}</p>
                  <p className="text-xs text-muted-foreground">{row.count} transaction(s)</p>
                </div>
                <span className="font-bold text-primary">{fmt(row.total_minor)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Operating expenses">
        <form onSubmit={handleAddExpense} className="mb-4 grid gap-3 sm:grid-cols-5 print:hidden">
          <select
            value={expCategory}
            onChange={(e) => setExpCategory(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
          >
            <option value="Ingredients">Ingredients</option>
            <option value="Staff">Staff</option>
            <option value="Utilities">Utilities</option>
            <option value="Packaging">Packaging</option>
            <option value="Marketing">Marketing</option>
            <option value="Other">Other</option>
          </select>
          <input
            required
            placeholder="Description *"
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs sm:col-span-2"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder={`Amount (${report?.currency ?? "EUR"})`}
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs"
          />
          <div className="flex gap-2">
            <input
              required
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="divide-y divide-border text-sm">
          {expenses.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            expenses.slice(0, 12).map((exp) => (
              <div key={exp.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold">{exp.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.category} · {exp.incurred_on}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-danger">-{fmt(exp.amount_minor)}</span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteExpense(exp.id)}
                    className="rounded-lg p-1 text-danger hover:bg-danger/10 print:hidden"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
