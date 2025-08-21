// Helper for calling Supabase Edge Functions with optional auth
// - getFunctionsBaseUrl(): env override or fallback to project ref domain
// - callFunction(path, body, includeAuth): POST JSON, attaches Authorization if requested

import { supabase } from "@/integrations/supabase/client";

const envBase = (import.meta as any).env?.VITE_FUNCTIONS_BASE_URL as string | undefined;
const fallbackBase = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

export function getFunctionsBaseUrl() {
  const base = (envBase && envBase.replace(/\/$/, "")) || fallbackBase;
  return base;
}

export async function callFunction(path: string, body?: unknown, includeAuth = true, method: 'GET' | 'POST' = 'POST') {
  // Ensure Supabase Edge Functions prefix
  const base = getFunctionsBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const finalPath = cleanPath.startsWith('/functions/v1/') ? cleanPath : `/functions/v1${cleanPath}`;
  const url = path.startsWith('http') ? path : `${base}${finalPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const isGet = method === 'GET';
  const res = await fetch(url, {
    method,
    headers,
    body: isGet ? undefined : JSON.stringify(body ?? {}),
    credentials: "omit",
    mode: "cors",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = (text || res.statusText || "").slice(0, 120);
    const err = new Error(`Request failed ${res.status}: ${snippet}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}
