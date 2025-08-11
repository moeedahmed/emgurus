import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseAllowlist(): string[] {
  try {
    const raw = Deno.env.get("ORIGIN_ALLOWLIST") || "";
    const list = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    return list.length ? list : ["*"];
  } catch {
    return ["*"];
  }
}

function resolveCors(req: Request) {
  const allowlist = parseAllowlist();
  const origin = req.headers.get("origin") || "";
  const allowAll = allowlist.includes("*");
  if (!allowAll && origin && !allowlist.includes(origin)) {
    return { ok: false, headers: { ...baseCorsHeaders } } as const;
  }
  const originToUse = allowAll ? (origin || "*") : origin;
  return { ok: true, headers: { ...baseCorsHeaders, "Access-Control-Allow-Origin": originToUse || "*" } } as const;
}

serve(async (req) => {
  const cors = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors.headers });
  }
  if (!cors.ok) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: { ...cors.headers, "Content-Type": "application/json" } });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    // Parse query params
    const u = new URL(req.url);
    const exam = u.searchParams.get("exam") || undefined;
    const topic = u.searchParams.get("topic") || undefined;
    const q = u.searchParams.get("q") || undefined;
    let limit = Number(u.searchParams.get("limit") || 24);
    let offset = Number(u.searchParams.get("offset") || 0);
    if (!Number.isFinite(limit) || limit <= 0) limit = 24;
    if (limit > 50) limit = 50;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    // Primary: reviewed_exam_questions
    let items: any[] = [];
    let count: number | undefined = undefined;

    // Build primary query
    let primary = admin
      .from("reviewed_exam_questions")
      .select("id, stem, exam_type, reviewed_at", { count: "exact" })
      .order("reviewed_at", { ascending: false })
      .order("id", { ascending: false });

    // Optional filters
    try {
      // Status filter (if column exists)
      const statusFiltered = primary.eq("status", "approved");
      primary = statusFiltered;
    } catch {}

    if (exam) {
      primary = primary.eq("exam_type", exam).or(`exam.eq.${exam}`);
    }
    if (topic) {
      // Try tags array contains, fallback topic column
      primary = primary.contains?.("tags" as any, [topic] as any) || primary.eq("topic" as any, topic as any);
    }
    if (q) {
      primary = primary.ilike("stem", `%${q}%`);
    }

    const { data: pData, count: pCount, error: pErr } = await primary.range(offset, offset + limit - 1);

    if (pErr && /relation .* does not exist/i.test(pErr.message)) {
      // Fallback: exam_questions
      let fb = admin
        .from("exam_questions")
        .select("id, stem, exam_type, created_at", { count: "exact" })
        .in("status", ["published", "approved", "reviewed", "approved_public"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (exam) fb = fb.eq("exam_type", exam).or(`exam.eq.${exam}`);
      if (topic) fb = (fb as any).contains?.("tags", [topic]) || (fb as any).eq("topic", topic);
      if (q) fb = fb.ilike("stem", `%${q}%`);
      const { data: fData, count: fCount, error: fErr } = await fb.range(offset, offset + limit - 1);
      if (fErr) throw fErr;
      items = (fData || []).map((r: any) => ({ id: r.id, stem: r.stem, exam_type: r.exam_type || r.exam, reviewed_at: r.created_at }));
      count = fCount ?? (items?.length ?? 0);
    } else if (pErr) {
      throw pErr;
    } else {
      items = (pData || []).map((r: any) => ({ id: r.id, stem: r.stem, exam_type: r.exam_type || r.exam, reviewed_at: r.reviewed_at || r.created_at }));
      count = pCount ?? (items?.length ?? 0);
    }

    return new Response(JSON.stringify({ ok: true, items, count }), {
      status: 200,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...baseCorsHeaders, "Content-Type": "application/json" },
    });
  }
});
