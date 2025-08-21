// Lightweight helper to call Supabase Edge Functions directly via HTTPS
// Uses VITE_FUNCTIONS_BASE_URL if provided; otherwise falls back to project default

const envBase = (import.meta as any).env?.VITE_FUNCTIONS_BASE_URL as string | undefined;
const fallbackBase = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

const baseUrl = (envBase && envBase.replace(/\/$/, "")) || fallbackBase;

export async function getJson(path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "omit",
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed ${res.status}`);
  }
  return res.json();
}

export { baseUrl };
