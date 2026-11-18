"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
  currency: string;
  timezone: string;
  orders_count: number;
  cancelled_orders_count: number;
  gross_sales_minor: number;
  net_sales_minor: number;
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

export function ReportsView({
  restaurantId,
  initialReport,
}: {
  restaurantId: string;
  initialReport: SalesReport | null;
}) {
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("7d");
  const [report, setReport] = useState<SalesReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api<SalesReport>(`/reports/sales?period=${period}`, {
          headers: { "X-Restaurant-Id": restaurantId },
        });
        if (active) setReport(res);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load sales report.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [period, restaurantId]);

  async function handleExportCsv() {
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/sales/export?period=${period}`, {
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

  const sym = currencySymbol(report?.currency ?? "EUR");
  const fmt = (minor: number) => `${sym}${(minor / 100).toFixed(2)}`;

  const kpis = [
    {
      label: "Gross sales",
      value: fmt(report?.gross_sales_minor ?? 0),
      sub: `Net: ${fmt(report?.net_sales_minor ?? 0)}`,
      bgClass: "bg-[#EAF4EE] border-[#D3E7DC]",
      labelClass: "text-[#0B2A22]",
    },
    {
      label: "Completed orders",
      value: String(report?.orders_count ?? 0),
      sub: `${report?.covers_served ?? 0} covers booked`,
      bgClass: "bg-[#FBF5E8] border-[#EFE2C6]",
      labelClass: "text-slate-600",
    },
    {
      label: "Average ticket",
      value: fmt(report?.average_order_value_minor ?? 0),
      sub: `Delivery fees: ${fmt(report?.delivery_fees_minor ?? 0)}`,
      bgClass: "bg-[#EBF3FA] border-[#D4E4F4]",
      labelClass: "text-slate-600",
    },
    {
      label: "Cancelled / Refunds",
      value: fmt(report?.cancelled_minor ?? 0),
      sub: `${report?.cancelled_orders_count ?? 0} cancelled order(s)`,
      bgClass: "bg-[#FAF0EE] border-[#F2D6D2]",
      labelClass: "text-[#B4322A]",
    },
    {
      label: "Estimated taxes",
      value: fmt(report?.estimated_tax_minor ?? 0),
      sub: `Timezone: ${report?.timezone ?? "UTC"}`,
      bgClass: "bg-[#F3EFFA] border-[#E2D6F5]",
      labelClass: "text-[#0B2A22]",
    },
  ];

  const series = report?.daily_series ?? [];
  const maxSales = Math.max(...series.map((p) => p.gross_sales_minor), 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales reports"
        description="Analyze your restaurant's revenue, average ticket, top dishes and service breakdown"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "today" | "7d" | "30d")}
              className="h-10 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
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
    </div>
  );
}
