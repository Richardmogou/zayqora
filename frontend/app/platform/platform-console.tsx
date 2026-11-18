"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, ExternalLink, PauseCircle, Search, ShieldCheck } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { currencySymbol } from "@/lib/currency-context";

export interface PlanSummary {
  code: string;
  name: string;
  price_monthly_eur: number;
  description: string;
  tenants_count: number;
}

export interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  status: "active" | "pending" | "suspended";
  plan: string;
  country: string;
  currency: string;
  timezone: string;
  owner_email: string | null;
  owner_name: string | null;
  members_count: number;
  orders_count: number;
  reservations_count: number;
  gross_sales_minor: number;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  restaurant_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformOverview {
  total_tenants: number;
  active_tenants: number;
  pending_tenants: number;
  suspended_tenants: number;
  total_users: number;
  total_orders: number;
  total_reservations: number;
  platform_gross_volume_minor: number;
  plans: PlanSummary[];
  recent_audit_logs: AuditLogItem[];
}

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

export function PlatformConsole({
  initialOverview,
  initialTenants,
}: {
  initialOverview: PlatformOverview;
  initialTenants: PlatformTenant[];
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<PlatformOverview>(initialOverview);
  const [tenants, setTenants] = useState<PlatformTenant[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reason, setReason] = useState("Routine VIRELEO platform compliance verification");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateTenant(
    tenant: PlatformTenant,
    nextStatus: "active" | "pending" | "suspended",
    nextPlan?: string
  ) {
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Enter an audit reason (at least 3 characters) before modifying tenant status or plan.");
      return;
    }
    setBusyId(tenant.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<PlatformTenant>(`/platform/tenants/${tenant.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          plan: nextPlan ?? tenant.plan,
          reason: reason.trim(),
        }),
      });
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? updated : t)));
      const refreshedOverview = await api<PlatformOverview>("/platform/overview");
      setOverview(refreshedOverview);
      setNotice(`Tenant "${updated.name}" updated (${updated.status} · ${updated.plan}). Audit log recorded.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tenant.");
    } finally {
      setBusyId(null);
    }
  }

  const query = search.trim().toLowerCase();
  const filteredTenants = tenants.filter((t) => {
    return (
      (statusFilter === "ALL" || t.status === statusFilter) &&
      (!query ||
        t.name.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query) ||
        (t.owner_email ?? "").toLowerCase().includes(query))
    );
  });

  const kpis = [
    { label: "Total tenants", value: String(overview.total_tenants), sub: `${overview.active_tenants} active · ${overview.pending_tenants} pending`, bg: "bg-[#EAF4EE] border-[#D3E7DC]" },
    { label: "Suspended tenants", value: String(overview.suspended_tenants), sub: "Access blocked until reactivated", bg: "bg-[#FAF0EE] border-[#F2D6D2]" },
    { label: "Platform orders", value: String(overview.total_orders), sub: `${overview.total_reservations} table bookings`, bg: "bg-[#FBF5E8] border-[#EFE2C6]" },
    { label: "Platform users", value: String(overview.total_users), sub: `GMV: €${(overview.platform_gross_volume_minor / 100).toFixed(2)}`, bg: "bg-[#EBF3FA] border-[#D4E4F4]" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="VIRELEO Super Admin — SaaS Control Plane"
        description="Manage restaurant tenants, subscription plans, platform health and privileged audit trails"
        action={
          <span className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Privileged Platform Session
          </span>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-5 text-[#0B2A22] ${kpi.bg}`}>
            <p className="text-xs font-semibold text-slate-600">{kpi.label}</p>
            <p className="mt-2.5 text-3xl font-extrabold">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-600">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <Card title="SaaS Subscription Plans & Entitlements">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.plans.map((plan) => (
            <div key={plan.code} className="flex flex-col justify-between rounded-2xl border border-border bg-muted/20 p-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-bold text-primary">{plan.name}</h3>
                  <span className="text-lg font-extrabold text-[#C4933F]">€{plan.price_monthly_eur}/mo</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold">
                <span>Subscribed tenants</span>
                <Badge tone="info">{plan.tenants_count}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Restaurant Tenant Administration">
        <div className="mb-4 grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search restaurant, slug or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All tenant statuses</option>
              <option value="active">Active (Published)</option>
              <option value="pending">Pending (Draft)</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="sm:col-span-5">
            <input
              type="text"
              placeholder="Mandatory audit reason for status/plan changes..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3.5">Tenant</th>
                <th className="px-4 py-3.5">Owner</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Usage &amp; Sales</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTenants.map((tenant) => {
                const sym = currencySymbol(tenant.currency);
                return (
                  <tr key={tenant.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span>{tenant.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        /r/{tenant.slug} · {tenant.country} · {tenant.timezone}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-medium text-foreground">{tenant.owner_name ?? "—"}</div>
                      <div className="text-muted-foreground">{tenant.owner_email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        disabled={busyId === tenant.id}
                        value={tenant.plan}
                        onChange={(e) => void updateTenant(tenant, tenant.status, e.target.value)}
                        className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-semibold capitalize focus:outline-none"
                      >
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-semibold">
                        {sym}
                        {(tenant.gross_sales_minor / 100).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">
                        {tenant.orders_count} orders · {tenant.reservations_count} bookings · {tenant.members_count} staff
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={STATUS_TONE[tenant.status] ?? "neutral"}>{tenant.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {tenant.status !== "active" && (
                          <button
                            type="button"
                            disabled={busyId === tenant.id}
                            onClick={() => void updateTenant(tenant, "active")}
                            className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                        {tenant.status !== "suspended" && (
                          <button
                            type="button"
                            disabled={busyId === tenant.id}
                            onClick={() => void updateTenant(tenant, "suspended")}
                            className="inline-flex items-center gap-1 rounded-lg bg-danger/15 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
                          >
                            <PauseCircle className="h-3.5 w-3.5" /> Suspend
                          </button>
                        )}
                        {tenant.status === "active" && (
                          <Link
                            href={`/r/${tenant.slug}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            Storefront <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent Platform & Tenant Audit Trail">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2.5 font-semibold">Timestamp</th>
                <th className="pb-2.5 font-semibold">Action</th>
                <th className="pb-2.5 font-semibold">Entity</th>
                <th className="pb-2.5 font-semibold">Details / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overview.recent_audit_logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2.5 font-mono font-semibold text-primary">{log.action}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {log.entity_type ?? "—"} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                    {log.data ? JSON.stringify(log.data) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
