// Helper for calling Supabase Edge Functions with optional auth
// - getFunctionsBaseUrl(): env override or fallback to project ref domain
// - callFunction(path, body, includeAuth): POST JSON, attaches Authorization if requested

import { supabase } from "@/integrations/supabase/client";

const envBase = (import.meta as any).env?.VITE_FUNCTIONS_BASE_URL as string | undefined;
const fallbackBase = "https://cgtvvpzrzwyvsbavboxa.functions.supabase.co"; // project ref fallback

export function getFunctionsBaseUrl() {
  const base = (envBase && envBase.replace(/\/$/, "")) || fallbackBase;
  return base;
}

export async function callFunction(path: string, body: unknown, includeAuth = true) {
  const url = path.startsWith("http") ? path : `${getFunctionsBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
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
