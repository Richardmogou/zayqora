/** N'autorise que les chemins internes : bloque //evil.com, https://..., javascript: et les boucles vers /login. */
export function safeRedirectPath(raw: string | string[] | undefined, fallback = "/dashboard"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    if (new URL(value, "http://localhost").origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  const path = value.split(/[?#]/)[0];
  if (path === "/login" || path.startsWith("/api/")) return fallback;
  return value;
}
