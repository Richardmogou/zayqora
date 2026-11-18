import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
          "/notifications",
          "/customers",
          "/reports",
          "/settings",
          "/platform",
          "/api/",
        ],
      },
    ],
    sitemap: "http://localhost:3000/sitemap.xml",
  };
}
