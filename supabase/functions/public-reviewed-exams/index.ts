import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeadersBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveCorsOrigin(req: Request): string {
  try {
    const allowlist = (Deno.env.get("ORIGIN_ALLOWLIST") || "").split(/[,\s]+/).filter(Boolean);
    const origin = req.headers.get("origin") || "*";
    if (!allowlist.length) return "*";
    return allowlist.includes(origin) ? origin : allowlist[0] || "*";
  } catch {
    return "*";
  }
}

serve(async (req) => {
  const corsOrigin = resolveCorsOrigin(req);
  const corsHeaders = { ...corsHeadersBase, "Access-Control-Allow-Origin": corsOrigin } as Record<string,string>;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    // Try reviewed_exam_questions first; if not available, fall back to exam_questions
    let items: any[] = [];
    let count = 0;

    // Primary attempt
    const primary = await admin
      .from("reviewed_exam_questions")
      .select("id, stem, choices, correct_index, explanation, exam_type, tags, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50);

    if (primary.error && /relation .* does not exist/i.test(primary.error.message)) {
      // Fallback to exam_questions with published/approved
      const fallback = await admin
        .from("exam_questions")
        .select("id, stem, choices, correct_index, explanation, exam_type, tags, created_at, status", { count: "exact" })
        .in("status", ["published", "approved", "reviewed", "approved_public"]) as any;
      if (fallback.error) throw fallback.error;
      const data = (fallback.data || []) as any[];
      items = data.map((q: any) => ({
        id: q.id,
        stem: q.stem,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation,
        exam_type: q.exam_type,
        tags: q.tags,
        created_at: q.created_at,
      }));
      count = fallback.count ?? items.length;
    } else if (primary.error) {
      throw primary.error;
    } else {
      const data = (primary.data || []) as any[];
      items = data;
      count = primary.count ?? data.length;
    }

    return new Response(JSON.stringify({ items, count }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
