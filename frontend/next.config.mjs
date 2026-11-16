// L'API passe par le site (même origine) : le cookie de session reste « first-party », sans CORS
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
};
export default nextConfig;
