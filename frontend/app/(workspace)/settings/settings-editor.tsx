"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { RestaurantInfo } from "@/lib/auth";

export interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  email: string;
  full_name: string;
}

export interface BranchItem {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  is_default: boolean;
}

export interface CouponItem {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_minor: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
}

export interface ReviewItem {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  status: string;
  owner_response: string | null;
  created_at: string;
}

const TIMEZONES = [
  "UTC",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Karachi",
  "Asia/Dubai",
];

const CURRENCIES = ["EUR", "USD", "GBP", "PKR", "AED", "CAD"];
const COUNTRIES = [
  { code: "FR", label: "France (FR)" },
  { code: "US", label: "United States (US)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "PK", label: "Pakistan (PK)" },
  { code: "AE", label: "United Arab Emirates (AE)" },
  { code: "CA", label: "Canada (CA)" },
];

export function SettingsEditor({
  restaurant,
  members: initialMembers,
  branches: initialBranches = [],
  coupons: initialCoupons = [],
  reviews: initialReviews = [],
  currentUserId,
  role,
}: {
  restaurant: RestaurantInfo;
  members: TeamMember[];
  branches?: BranchItem[];
  coupons?: CouponItem[];
  reviews?: ReviewItem[];
  currentUserId: string;
  role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [country, setCountry] = useState(restaurant.country);
  const [currency, setCurrency] = useState(restaurant.currency);
  const [timezone, setTimezone] = useState(restaurant.timezone);
  const [status, setStatus] = useState(restaurant.status);
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [branches, setBranches] = useState<BranchItem[]>(initialBranches);
  const [coupons, setCoupons] = useState<CouponItem[]>(initialCoupons);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");

  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percentage" | "fixed" | "free_delivery">("percentage");
  const [couponValue, setCouponValue] = useState("15");
  const [couponMinOrder, setCouponMinOrder] = useState("20");

  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEditRestaurant = role === "owner" || role === "manager";
  const isOwner = role === "owner";

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!canEditRestaurant) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<RestaurantInfo>("/restaurants/me", {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({ name: name.trim(), country, currency, timezone }),
      });
      setName(updated.name);
      setCountry(updated.country);
      setCurrency(updated.currency);
      setTimezone(updated.timezone);
      setNotice("Restaurant settings updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update restaurant settings.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!canEditRestaurant) return;
    const nextStatus = status === "active" ? "pending" : "active";
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<RestaurantInfo>("/restaurants/me", {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({ status: nextStatus }),
      });
      setStatus(updated.status);
      setNotice(
        updated.status === "active"
          ? "Your public restaurant website is now published and live."
          : "Your restaurant website has been returned to draft."
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change publication state.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!isOwner || !inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api<TeamMember>("/members", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          role: inviteRole,
        }),
      });
      setMembers((prev) => [...prev.filter((m) => m.id !== created.id), created]);
      setInviteName("");
      setInviteEmail("");
      setNotice(`${created.full_name} added as ${created.role}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite staff member.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!isOwner) return;
    setError(null);
    setNotice(null);
    try {
      await api(`/members/${memberId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurant.id },
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setNotice("Staff member removed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove staff member.");
    }
  }

  async function handleCreateBranch(e: FormEvent) {
    e.preventDefault();
    if (!canEditRestaurant || !branchName.trim()) return;
    setError(null);
    setNotice(null);
    try {
      const created = await api<BranchItem>("/branches", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({
          name: branchName.trim(),
          address: branchAddress.trim() || null,
          is_default: false,
        }),
      });
      setBranches((prev) => [...prev, created]);
      setBranchName("");
      setBranchAddress("");
      setNotice(`Branch "${created.name}" created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create branch.");
    }
  }

  async function handleCreateCoupon(e: FormEvent) {
    e.preventDefault();
    if (!canEditRestaurant || !couponCode.trim()) return;
    setError(null);
    setNotice(null);
    try {
      const rawVal = Number.parseFloat(couponValue) || 0;
      const discountValue = couponType === "fixed" ? Math.round(rawVal * 100) : Math.round(rawVal);
      const minOrderMinor = Math.round((Number.parseFloat(couponMinOrder) || 0) * 100);
      const created = await api<CouponItem>("/coupons", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          discount_type: couponType,
          discount_value: discountValue,
          min_order_minor: minOrderMinor,
        }),
      });
      setCoupons((prev) => [created, ...prev]);
      setCouponCode("");
      setNotice(`Promo code "${created.code}" created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create coupon.");
    }
  }

  async function handleDeleteCoupon(couponId: string) {
    if (!canEditRestaurant) return;
    try {
      await api(`/coupons/${couponId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurant.id },
      });
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete coupon.");
    }
  }

  async function handleModerateReview(reviewId: string, nextStatus: "approved" | "rejected") {
    if (!canEditRestaurant) return;
    try {
      const updated = await api<ReviewItem>(`/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({ status: nextStatus }),
      });
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not moderate review.");
    }
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm focus:border-primary focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-12">
        <Card title="Restaurant profile & localization" className="lg:col-span-7">
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Restaurant name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  disabled={!canEditRestaurant}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Public URL slug</label>
                <input type="text" disabled value={`/r/${restaurant.slug}`} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Country</label>
                <select
                  disabled={!canEditRestaurant}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Currency</label>
                <select
                  disabled={!canEditRestaurant}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Timezone (IANA)</label>
                <select
                  disabled={!canEditRestaurant}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputClass}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {canEditRestaurant && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </form>
        </Card>

        <Card title="Public website publishing" className="lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Storefront status</p>
                  <p className="text-xs text-muted-foreground">/r/{restaurant.slug}</p>
                </div>
              </div>
              <Badge tone={status === "active" ? "success" : "warning"}>
                {status === "active" ? "Published" : "Draft / Pending"}
              </Badge>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              When published, customers can browse your public website, customize menu items, place online orders and request table reservations.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {canEditRestaurant && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void togglePublish()}
                  className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                    status === "active"
                      ? "border border-border bg-card hover:bg-muted/40"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {status === "active" ? "Return to draft" : "Publish website"}
                </button>
              )}
              {status === "active" && (
                <Link
                  href={`/r/${restaurant.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold hover:bg-muted/40"
                >
                  Open public site <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Team & staff roles">
        <div className="space-y-5">
          {isOwner && (
            <form onSubmit={handleInvite} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-4">
              <input
                type="text"
                required
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                required
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className={inputClass}
              />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={inputClass}>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="kitchen">Kitchen / Chef</option>
                <option value="waiter">Waiter</option>
                <option value="rider">Delivery Rider</option>
                <option value="accountant">Accountant</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> {inviting ? "Adding..." : "Invite staff"}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium">{member.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3 capitalize">
                      <Badge tone="info">{member.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={member.is_active ? "success" : "neutral"}>
                        {member.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOwner && member.user_id !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(member.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Branches & locations">
          <div className="space-y-4">
            {canEditRestaurant && (
              <form onSubmit={handleCreateBranch} className="grid gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  placeholder="Branch name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add branch
                </button>
              </form>
            )}
            <div className="divide-y divide-border text-sm">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    {b.address && <p className="text-xs text-muted-foreground">{b.address}</p>}
                  </div>
                  <Badge tone={b.is_default ? "success" : "neutral"}>
                    {b.is_default ? "Main branch" : "Secondary"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Promo codes & coupons">
          <div className="space-y-4">
            {canEditRestaurant && (
              <form onSubmit={handleCreateCoupon} className="grid gap-2.5 sm:grid-cols-4">
                <input
                  type="text"
                  required
                  placeholder="CODE (e.g. WELCOME15)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className={inputClass}
                />
                <select
                  value={couponType}
                  onChange={(e) => setCouponType(e.target.value as "percentage" | "fixed" | "free_delivery")}
                  className={inputClass}
                >
                  <option value="percentage">% Discount</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="Value"
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Create
                </button>
              </form>
            )}
            <div className="divide-y divide-border text-xs">
              {coupons.length === 0 && <p className="py-4 text-muted-foreground">No active promo codes.</p>}
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-mono font-bold text-primary">{c.code}</span>
                    <span className="ml-2 text-muted-foreground">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}% off`
                        : c.discount_type === "free_delivery"
                        ? "Free delivery"
                        : `${(c.discount_value / 100).toFixed(2)} off`}{" "}
                      · {c.used_count} used
                    </span>
                  </div>
                  {canEditRestaurant && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteCoupon(c.id)}
                      className="text-danger hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {reviews.length > 0 && (
        <Card title="Customer reviews moderation">
          <div className="divide-y divide-border text-sm">
            {reviews.map((rev) => (
              <div key={rev.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{rev.customer_name}</span>
                    <span className="text-xs font-bold text-amber-500">{"★".repeat(rev.rating)}</span>
                    <Badge tone={rev.status === "approved" ? "success" : rev.status === "rejected" ? "danger" : "warning"}>
                      {rev.status}
                    </Badge>
                  </div>
                  {rev.comment && <p className="mt-1 text-xs text-muted-foreground">{rev.comment}</p>}
                </div>
                {canEditRestaurant && (
                  <div className="flex items-center gap-2 text-xs">
                    {rev.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => void handleModerateReview(rev.id, "approved")}
                        className="rounded-lg bg-success/15 px-2.5 py-1 font-semibold text-success"
                      >
                        Approve
                      </button>
                    )}
                    {rev.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => void handleModerateReview(rev.id, "rejected")}
                        className="rounded-lg bg-danger/15 px-2.5 py-1 font-semibold text-danger"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
