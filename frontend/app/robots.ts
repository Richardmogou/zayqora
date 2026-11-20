import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/r/"],
        disallow: [
          "/dashboard",
          "/orders",
          "/menu",
          "/kitchen",
          "/reservations",
          "/inventory",
          "/notifications",
          "/customers",
          "/reports",
          "/settings",
          "/platform",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
