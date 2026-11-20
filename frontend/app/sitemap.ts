import type { MetadataRoute } from "next";

interface PublicRestaurantEntry {
  slug: string;
  updated_at?: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:8000").replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  let restaurants: PublicRestaurantEntry[] = [];
  try {
    const res = await fetch(`${apiOrigin}/api/v1/public/restaurants`, { cache: "no-store" });
    if (res.ok) restaurants = (await res.json()) as PublicRestaurantEntry[];
  } catch {
    restaurants = [];
  }

  const storefrontEntries: MetadataRoute.Sitemap = restaurants.flatMap((restaurant) => {
    const updated = restaurant.updated_at ? new Date(restaurant.updated_at) : now;
    const base = `${baseUrl}/r/${restaurant.slug}`;
    return [
      { url: base, lastModified: updated, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/menu`, lastModified: updated, changeFrequency: "daily", priority: 0.85 },
      { url: `${base}/reservations`, lastModified: updated, changeFrequency: "daily", priority: 0.8 },
      { url: `${base}/offers`, lastModified: updated, changeFrequency: "daily", priority: 0.7 },
      { url: `${base}/reviews`, lastModified: updated, changeFrequency: "daily", priority: 0.7 },
      { url: `${base}/about`, lastModified: updated, changeFrequency: "weekly", priority: 0.6 },
      { url: `${base}/contact`, lastModified: updated, changeFrequency: "monthly", priority: 0.6 },
    ];
  });

  return [...staticEntries, ...storefrontEntries];
}
