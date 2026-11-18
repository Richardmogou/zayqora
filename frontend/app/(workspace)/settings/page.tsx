import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import {
  SettingsEditor,
  type BranchItem,
  type CouponItem,
  type ReviewItem,
  type TeamMember,
} from "./settings-editor";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const [restaurant, members, branches, coupons, reviews] = restaurantId
    ? await Promise.all([
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
        serverFetch<TeamMember[]>("/members", headers),
        serverFetch<BranchItem[]>("/branches", headers),
        serverFetch<CouponItem[]>("/coupons", headers),
        serverFetch<ReviewItem[]>("/reviews", headers),
      ])
    : [null, null, null, null, null];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your restaurant profile, branches, promo codes, reviews and staff permissions"
      />
      {restaurant && me && membership ? (
        <SettingsEditor
          restaurant={restaurant}
          members={members ?? []}
          branches={branches ?? []}
          coupons={coupons ?? []}
          reviews={reviews ?? []}
          currentUserId={me.user.id}
          role={membership.role}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant workspace selected.</p>
      )}
    </div>
  );
}
