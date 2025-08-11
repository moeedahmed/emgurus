// Guru review workflow for exam questions
// - Requires JWT and role guru or admin
// - CORS allowlist via ORIGIN_ALLOWLIST
// - Uses service role for DB ops, validates caller via Authorization JWT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN_ALLOWLIST = (Deno.env.get("ORIGIN_ALLOWLIST") || "").split(",").map(s => s.trim()).filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function allowOrigin(origin: string | null): string | null {
  if (!origin) return "*"; // allow server-to-server
  if (ORIGIN_ALLOWLIST.length === 0) return "*"; // fallback dev
  const ok = ORIGIN_ALLOWLIST.some(o => o === "*" || o.toLowerCase() === origin.toLowerCase());
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

// Whitelist of updatable fields on questions
const EDITABLE_FIELDS = new Set([
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "explanation",
  "exam_type",
  "difficulty_level",
  "topic",
  "subtopic",
  "keywords",
]);

function sanitizeUpdates(upd: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(upd || {})) {
    if (EDITABLE_FIELDS.has(k)) out[k] = v;
  }
  return out;
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

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await svc.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return json(401, { ok: false, error: "Invalid token" }, origin);
  }
  const userId = userData.user.id;

  const { data: roles, error: roleErr } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleErr) return json(500, { ok: false, error: "Role check failed" }, origin);
  const canUse = (roles || []).some((r: any) => r.role === "guru" || r.role === "admin");
  if (!canUse) return json(403, { ok: false, error: "Forbidden" }, origin);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  try {
    // GET /queue
    if (req.method === "GET" && path.endsWith("/queue")) {
      const { data: assigns, error: aErr } = await svc
        .from("exam_review_assignments")
        .select("id, question_id, created_at, note")
        .eq("reviewer_id", userId)
        .eq("status", "assigned")
        .order("created_at", { ascending: false })
        .limit(100);
      if (aErr) return json(500, { ok: false, error: "Failed to load queue" }, origin);
      const qids = (assigns || []).map((a: any) => a.question_id);
      let questions: any[] = [];
      if (qids.length > 0) {
        const { data: qs, error: qErr } = await svc
          .from("questions")
          .select("id, created_at, question_text, exam_type, difficulty_level, topic")
          .in("id", qids);
        if (qErr) return json(500, { ok: false, error: "Failed to load questions" }, origin);
        questions = qs || [];
      }
      const qmap = new Map(questions.map((q: any) => [q.id, q]));
      const out = (assigns || []).map((a: any) => ({
        assignment_id: a.id,
        question_id: a.question_id,
        created_at: a.created_at,
        note: a.note,
        preview: qmap.get(a.question_id) || null,
      }));
      return json(200, { ok: true, data: out }, origin);
    }

    // GET /item/:question_id
    if (req.method === "GET" && /\/item\/.+/.test(path)) {
      const parts = path.split("/item/");
      const qid = parts[1];
      if (!qid) return json(400, { ok: false, error: "Missing question id" }, origin);
      const { data: q, error: qErr } = await svc
        .from("questions")
        .select("*")
        .eq("id", qid)
        .maybeSingle();
      if (qErr) return json(500, { ok: false, error: "Failed to load item" }, origin);
      if (!q) return json(404, { ok: false, error: "Not found" }, origin);
      return json(200, { ok: true, data: q }, origin);
    }

    // POST /save-and-approve
    if (req.method === "POST" && path.endsWith("/save-and-approve")) {
      const body = await req.json().catch(() => ({}));
      const assignment_id: string | undefined = body?.assignment_id;
      const question_id: string | undefined = body?.question_id;
      const updatesRaw: Record<string, unknown> = body?.updates || {};
      if (!assignment_id || !question_id) {
        return json(400, { ok: false, error: "Missing assignment_id or question_id" }, origin);
      }

      // 1) Verify assignment belongs to caller and is assigned
      const { data: assign, error: aErr } = await svc
        .from("exam_review_assignments")
        .select("id, reviewer_id, question_id, status")
        .eq("id", assignment_id)
        .maybeSingle();
      if (aErr) return json(500, { ok: false, error: "Failed to load assignment" }, origin);
      if (!assign || assign.reviewer_id !== userId || assign.question_id !== question_id || assign.status !== "assigned") {
        return json(403, { ok: false, error: "Invalid assignment" }, origin);
      }

      // 2) Update question fields
      const updates = sanitizeUpdates(updatesRaw);
      updates["updated_at"] = new Date().toISOString();
      updates["status"] = "approved"; // helpful status
      updates["reviewed_by"] = userId;
      const { error: uErr } = await svc
        .from("questions")
        .update(updates)
        .eq("id", question_id);
      if (uErr) return json(500, { ok: false, error: "Failed to update question" }, origin);

      // 3) Mark assignment approved
      const { error: aUpdErr } = await svc
        .from("exam_review_assignments")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", assignment_id);
      if (aUpdErr) return json(500, { ok: false, error: "Failed to mark approved" }, origin);

      return json(200, { ok: true, question_id }, origin);
    }

    // POST /reject
    if (req.method === "POST" && path.endsWith("/reject")) {
      const body = await req.json().catch(() => ({}));
      const assignment_id: string | undefined = body?.assignment_id;
      const question_id: string | undefined = body?.question_id;
      const note: string | undefined = body?.note;
      if (!assignment_id || !question_id || !note) {
        return json(400, { ok: false, error: "Missing assignment_id, question_id, or note" }, origin);
      }

      const { data: assign, error: aErr } = await svc
        .from("exam_review_assignments")
        .select("id, reviewer_id, question_id, status")
        .eq("id", assignment_id)
        .maybeSingle();
      if (aErr) return json(500, { ok: false, error: "Failed to load assignment" }, origin);
      if (!assign || assign.reviewer_id !== userId || assign.question_id !== question_id || assign.status !== "assigned") {
        return json(403, { ok: false, error: "Invalid assignment" }, origin);
      }

      const { error: aUpdErr } = await svc
        .from("exam_review_assignments")
        .update({ status: "rejected", note, updated_at: new Date().toISOString() })
        .eq("id", assignment_id);
      if (aUpdErr) return json(500, { ok: false, error: "Failed to mark rejected" }, origin);

      // Optional: reflect in question status
      await svc.from("questions").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", question_id);

      return json(200, { ok: true, question_id }, origin);
    }

    return json(404, { ok: false, error: "Not found" }, origin);
  } catch (e) {
    console.error("exams-guru-review error", (e as Error).message);
    return json(500, { ok: false, error: "Server error" }, origin);
  }
});
