import { cookies } from "next/headers";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

export type Membership = {
  restaurant_id: string; restaurant_name: string; restaurant_slug: string; restaurant_status: string; role: string;
};
export type Me = {
  user: { id: string; email: string; full_name: string; is_platform_admin: boolean };
  memberships: Membership[];
};
export type RestaurantInfo = {
  id: string;
  slug: string;
  name: string;
  status: string;
  country: string;
  currency: string;
  timezone: string;
  reservation_opening_hours?: Record<string, [string, string][]> | null;
};

/** Appel serveur → API, en transmettant le cookie reçu du navigateur. */
export async function serverFetch<T>(path: string, headers: Record<string, string> = {}): Promise<T | null> {
  const cookie = cookies().toString();
  if (!cookie && !path.startsWith("/public/")) return null;
  try {
    const requestHeaders = { ...headers };
    if (cookie) requestHeaders.cookie = cookie;
    const res = await fetch(`${API_ORIGIN}/api/v1${path}`, { headers: requestHeaders, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const getCurrentUser = () => serverFetch<Me>("/auth/me");
