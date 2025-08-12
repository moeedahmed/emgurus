// Admin curation for AI-generated exam questions
// - Requires JWT and admin role
// - CORS allowlist via ORIGIN_ALLOWLIST
// - Uses service role for DB ops, validates caller via Authorization JWT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN_ALLOWLIST = (Deno.env.get("ORIGIN_ALLOWLIST") || "").split(",").map(s => s.trim()).filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function allowOrigin(origin: string | null): string | null {
  if (!origin) return "*"; // allow server-to-server
  const host = origin.toLowerCase();
  // Always allow Lovable preview/staging domains for development
  if (host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app')) return origin;
  if (ORIGIN_ALLOWLIST.length === 0) return "*"; // fallback dev
  const ok = ORIGIN_ALLOWLIST.some(o => o === "*" || o.toLowerCase() === host);
  return ok ? origin : null;
}

function json(status: number, data: unknown, origin: string | null) {
  const allowed = allowOrigin(origin);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Access-Control-Allow-Origin": allowed },
  });
}

// Small helper to preview question text
function preview(text?: string, len = 140) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > len ? t.slice(0, len - 1) + "…" : t;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    const allowed = allowOrigin(origin) || "*";
    return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } });
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json(401, { ok: false, error: "Missing bearer token" }, origin);
  }
  const token = auth.slice("Bearer ".length);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Verify user & role
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return json(401, { ok: false, error: "Invalid token" }, origin);
  }
  const userId = userData.user.id;

  const { data: roles, error: roleErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleErr) return json(500, { ok: false, error: "Role check failed" }, origin);
  const isAdmin = (roles || []).some((r: any) => r.role === "admin");
  if (!isAdmin) return json(403, { ok: false, error: "Forbidden" }, origin);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ""); // trim trailing slash

  try {
    // GET /generated
    if (req.method === "GET" && path.endsWith("/generated")) {
      // Fetch AI-generated questions (latest 200 to filter client-side)
      const { data: qs, error: qErr } = await adminClient
        .from("questions")
        .select("id, created_at, question_text, exam_type, difficulty_level, topic, is_ai_generated")
        .eq("is_ai_generated", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (qErr) return json(500, { ok: false, error: "Failed to load questions" }, origin);

      // Fetch any assignments to exclude
      const { data: assigned, error: aErr } = await adminClient
        .from("exam_review_assignments")
        .select("question_id");
      if (aErr) return json(500, { ok: false, error: "Failed to load assignments" }, origin);
      const assignedSet = new Set((assigned || []).map((a: any) => a.question_id));

      const list = (qs || [])
        .filter((q: any) => !assignedSet.has(q.id))
        .slice(0, 50)
        .map((q: any) => ({
          id: q.id,
          created_at: q.created_at,
          question_text: preview(q.question_text, 140),
          exam_type: q.exam_type,
          difficulty_level: q.difficulty_level,
          topic: q.topic,
        }));

      return json(200, { ok: true, data: list }, origin);
    }

    // GET /gurus
    if (req.method === "GET" && path.endsWith("/gurus")) {
      const { data: gurus, error: gErr } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "guru");
      if (gErr) return json(500, { ok: false, error: "Failed to load gurus" }, origin);

      const guruIds = (gurus || []).map((g: any) => g.user_id);
      let profiles: Record<string, { email?: string; full_name?: string }> = {};
      if (guruIds.length > 0) {
        const { data: profs } = await adminClient
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", guruIds);
        (profs || []).forEach((p: any) => {
          profiles[p.user_id] = { email: p.email, full_name: p.full_name };
        });
      }
      const out = guruIds.map((id: string) => {
        const p = profiles[id] || {};
        const label = p.full_name || p.email || id;
        return { id, label };
      });
      return json(200, { ok: true, data: out }, origin);
    }

    // POST /assign
    if (req.method === "POST" && path.endsWith("/assign")) {
      const body = await req.json().catch(() => ({}));
      const question_ids: string[] = Array.isArray(body?.question_ids) ? body.question_ids : [];
      const reviewer_id: string | undefined = body?.reviewer_id;
      if (!reviewer_id || question_ids.length === 0) {
        return json(400, { ok: false, error: "Missing question_ids or reviewer_id" }, origin);
      }

      // Ignore duplicates by checking existing rows
      const { data: existing } = await adminClient
        .from("exam_review_assignments")
        .select("question_id")
        .in("question_id", question_ids)
        .eq("reviewer_id", reviewer_id);
      const existingSet = new Set((existing || []).map((e: any) => e.question_id));
      const inserts = question_ids
        .filter((id) => !existingSet.has(id))
        .map((id) => ({ question_id: id, reviewer_id, assigned_by: userId, status: "assigned" }));

      if (inserts.length > 0) {
        const { error: insErr } = await adminClient.from("exam_review_assignments").insert(inserts);
        if (insErr) return json(500, { ok: false, error: "Failed to assign" }, origin);
      }
      return json(200, { ok: true, data: { assigned: inserts.length } }, origin);
    }

    // GET /approved
    if (req.method === "GET" && path.endsWith("/approved")) {
      const { data: rows, error: rErr } = await adminClient
        .from("exam_review_assignments")
        .select("question_id, updated_at")
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (rErr) return json(500, { ok: false, error: "Failed to load approved" }, origin);
      const ids = (rows || []).map((r: any) => r.question_id);
      if (ids.length === 0) return json(200, { ok: true, data: [] }, origin);
      const { data: qs, error: qErr } = await adminClient
        .from("questions")
        .select("id, created_at, question_text, exam_type, difficulty_level, topic")
        .in("id", ids);
      if (qErr) return json(500, { ok: false, error: "Failed to load questions" }, origin);
      const out = (qs || []).map((q: any) => ({
        id: q.id,
        created_at: q.created_at,
        question_text: preview(q.question_text, 140),
        exam_type: q.exam_type,
        difficulty_level: q.difficulty_level,
        topic: q.topic,
      }));
      return json(200, { ok: true, data: out }, origin);
    }

    // GET /rejected
    if (req.method === "GET" && path.endsWith("/rejected")) {
      const { data: rows, error: rErr } = await adminClient
        .from("exam_review_assignments")
        .select("question_id, updated_at")
        .eq("status", "rejected")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (rErr) return json(500, { ok: false, error: "Failed to load rejected" }, origin);
      const ids = (rows || []).map((r: any) => r.question_id);
      if (ids.length === 0) return json(200, { ok: true, data: [] }, origin);
      const { data: qs, error: qErr } = await adminClient
        .from("questions")
        .select("id, created_at, question_text, exam_type, difficulty_level, topic")
        .in("id", ids);
      if (qErr) return json(500, { ok: false, error: "Failed to load questions" }, origin);
      const out = (qs || []).map((q: any) => ({
        id: q.id,
        created_at: q.created_at,
        question_text: preview(q.question_text, 140),
        exam_type: q.exam_type,
        difficulty_level: q.difficulty_level,
        topic: q.topic,
      }));
      return json(200, { ok: true, data: out }, origin);
    }

    // GET /assigned
    if (req.method === "GET" && path.endsWith("/assigned")) {
      const { data: rows, error: rErr } = await adminClient
        .from("exam_review_assignments")
        .select("question_id, created_at")
        .eq("status", "assigned")
        .order("created_at", { ascending: false })
        .limit(100);
      if (rErr) return json(500, { ok: false, error: "Failed to load assigned" }, origin);
      const ids = (rows || []).map((r: any) => r.question_id);
      if (ids.length === 0) return json(200, { ok: true, data: [] }, origin);
      const { data: qs, error: qErr } = await adminClient
        .from("questions")
        .select("id, created_at, question_text, exam_type, difficulty_level, topic")
        .in("id", ids);
      if (qErr) return json(500, { ok: false, error: "Failed to load questions" }, origin);
      const out = (qs || []).map((q: any) => ({
        id: q.id,
        created_at: q.created_at,
        question_text: preview(q.question_text, 140),
        exam_type: q.exam_type,
        difficulty_level: q.difficulty_level,
        topic: q.topic,
      }));
      return json(200, { ok: true, data: out }, origin);
    }

    // POST /archive
    if (req.method === "POST" && path.endsWith("/archive")) {
      const body = await req.json().catch(() => ({}));
      const question_ids: string[] = Array.isArray(body?.question_ids) ? body.question_ids : [];
      if (question_ids.length === 0) return json(400, { ok: false, error: "No question_ids provided" }, origin);
      const { error: upErr } = await adminClient
        .from("questions")
        .update({ status: "archived" })
        .in("id", question_ids);
      if (upErr) return json(500, { ok: false, error: "Failed to archive" }, origin);
      return json(200, { ok: true, data: { archived: question_ids.length } }, origin);
    }

    return json(404, { ok: false, error: "Not found" }, origin);
  } catch (e) {
    console.error("exams-admin-curate error", (e as Error).message);
    return json(500, { ok: false, error: "Server error" }, origin);
  }
});
