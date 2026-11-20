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
  const [tagline, setTagline] = useState(restaurant.tagline ?? "");
  const [description, setDescription] = useState(restaurant.description ?? "");
  const [cuisine, setCuisine] = useState(restaurant.cuisine ?? "");
  const [phone, setPhone] = useState(restaurant.phone ?? "");
  const [contactEmail, setContactEmail] = useState(restaurant.contact_email ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(restaurant.cover_image_url ?? "");
  const [deliveryFee, setDeliveryFee] = useState(((restaurant.delivery_fee_minor ?? 400) / 100).toFixed(2));
  const [taxRatePct, setTaxRatePct] = useState(((restaurant.tax_rate_bps ?? 1000) / 100).toFixed(2));
  const [privacyPolicy, setPrivacyPolicy] = useState(restaurant.privacy_policy ?? "");
  const [termsOfService, setTermsOfService] = useState(restaurant.terms_of_service ?? "");
  const [refundPolicy, setRefundPolicy] = useState(restaurant.refund_policy ?? "");
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

  async function uploadAsset(file: File, target: "logo" | "cover") {
    if (!canEditRestaurant) return;
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/v1/menu/images", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Upload failed.");
      }
      const data: { url: string } = await res.json();
      if (target === "logo") setLogoUrl(data.url);
      else setCoverImageUrl(data.url);
      setNotice(`${target === "logo" ? "Logo" : "Cover image"} uploaded. Save changes to apply.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!canEditRestaurant) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const feeMinor = Math.max(0, Math.round((Number.parseFloat(deliveryFee) || 0) * 100));
      const taxBps = Math.max(0, Math.min(5000, Math.round((Number.parseFloat(taxRatePct) || 0) * 100)));
      const updated = await api<RestaurantInfo>("/restaurants/me", {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurant.id },
        body: JSON.stringify({
          name: name.trim(),
          country,
          currency,
          timezone,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          cuisine: cuisine.trim() || null,
          phone: phone.trim() || null,
          contact_email: contactEmail.trim() || null,
          address: address.trim() || null,
          logo_url: logoUrl.trim() || null,
          cover_image_url: coverImageUrl.trim() || null,
          delivery_fee_minor: feeMinor,
          tax_rate_bps: taxBps,
          privacy_policy: privacyPolicy.trim() || null,
          terms_of_service: termsOfService.trim() || null,
          refund_policy: refundPolicy.trim() || null,
        }),
      });
      setName(updated.name);
      setCountry(updated.country);
      setCurrency(updated.currency);
      setTimezone(updated.timezone);
      setDeliveryFee(((updated.delivery_fee_minor ?? 400) / 100).toFixed(2));
      setTaxRatePct(((updated.tax_rate_bps ?? 1000) / 100).toFixed(2));
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Cuisine / category</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="French Bistro, Pizza, Bakery..."
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Hero tagline</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="A culinary experience that brings people together"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold">About / restaurant story</label>
              <textarea
                rows={3}
                disabled={!canEditRestaurant}
                placeholder="Share your story, ingredients and dining philosophy..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Phone</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="+33 1 23 45 67 89"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Contact email</label>
                <input
                  type="email"
                  disabled={!canEditRestaurant}
                  placeholder="hello@restaurant.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Street address</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="12 Rue de Rivoli, Paris"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Delivery fee ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEditRestaurant}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Tax rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  disabled={!canEditRestaurant}
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Logo URL / upload</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="/api/v1/public/uploads/..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className={inputClass}
                />
                {canEditRestaurant && (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAsset(f, "logo");
                    }}
                    className="block text-xs text-muted-foreground"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Hero cover URL / upload</label>
                <input
                  type="text"
                  disabled={!canEditRestaurant}
                  placeholder="/api/v1/public/uploads/..."
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className={inputClass}
                />
                {canEditRestaurant && (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAsset(f, "cover");
                    }}
                    className="block text-xs text-muted-foreground"
                  />
                )}
              </div>
            </div>

            <details className="rounded-xl border border-border bg-muted/20 p-3.5">
              <summary className="cursor-pointer text-xs font-semibold">
                Legal &amp; cancellation policies (published at /r/{restaurant.slug}/legal)
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Privacy policy</label>
                  <textarea
                    rows={2}
                    disabled={!canEditRestaurant}
                    value={privacyPolicy}
                    onChange={(e) => setPrivacyPolicy(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Terms of service</label>
                  <textarea
                    rows={2}
                    disabled={!canEditRestaurant}
                    value={termsOfService}
                    onChange={(e) => setTermsOfService(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Refund &amp; cancellation policy</label>
                  <textarea
                    rows={2}
                    disabled={!canEditRestaurant}
                    value={refundPolicy}
                    onChange={(e) => setRefundPolicy(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </details>

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

            <ul className="space-y-1.5 rounded-xl border border-border bg-muted/15 p-3.5 text-xs">
              <li className="flex items-center justify-between">
                <span>Restaurant name &amp; localization</span>
                <Badge tone={name.trim() ? "success" : "warning"}>{name.trim() ? "Ready" : "Missing"}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span>Contact details (address / phone / email)</span>
                <Badge tone={address.trim() || phone.trim() || contactEmail.trim() ? "success" : "warning"}>
                  {address.trim() || phone.trim() || contactEmail.trim() ? "Ready" : "Recommended"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span>Branding (tagline / logo / cover)</span>
                <Badge tone={tagline.trim() || logoUrl.trim() || coverImageUrl.trim() ? "success" : "warning"}>
                  {tagline.trim() || logoUrl.trim() || coverImageUrl.trim() ? "Ready" : "Recommended"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span>Legal &amp; cancellation policies</span>
                <Badge tone={privacyPolicy.trim() || refundPolicy.trim() ? "success" : "warning"}>
                  {privacyPolicy.trim() || refundPolicy.trim() ? "Custom" : "Default"}
                </Badge>
              </li>
            </ul>

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
