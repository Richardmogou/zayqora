export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const BASE = "/api/v1"; // réécrit par Next vers l'API : même origine, donc cookie de session fiable

/** Appel depuis le navigateur. Le cookie de session est envoyé automatiquement. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;

  let body: { detail?: unknown } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      window.location.assign(`/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(res.status, typeof body?.detail === "string" ? body.detail : res.statusText);
  }
  return body as T;
}
