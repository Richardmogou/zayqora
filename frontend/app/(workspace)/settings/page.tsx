import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, serverFetch, type RestaurantInfo } from "@/lib/auth";
import { SettingsEditor, type TeamMember } from "./settings-editor";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  const membership = me?.memberships[0];
  const restaurantId = membership?.restaurant_id ?? null;
  const headers: Record<string, string> = restaurantId ? { "X-Restaurant-Id": restaurantId } : {};

  const [restaurant, members] = restaurantId
    ? await Promise.all([
        serverFetch<RestaurantInfo>("/restaurants/me", headers),
        serverFetch<TeamMember[]>("/members", headers),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your restaurant profile, public storefront status and staff permissions"
      />
      {restaurant && me && membership ? (
        <SettingsEditor
          restaurant={restaurant}
          members={members ?? []}
          currentUserId={me.user.id}
          role={membership.role}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No restaurant workspace selected.</p>
      )}
    </div>
  );
}
