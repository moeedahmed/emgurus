import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SeedResult = {
  inserted: number;
  assignments: number;
  reviewers: number;
  skipped: number;
};

// Simple curriculum mapping per system to SLO/KeyCap numbers
const SYSTEM_TO_CURRICULUM: Record<string, { slo: number; cap: number; slo_title: string; cap_title: string }[]> = {
  Resuscitation: [
    { slo: 1, cap: 1, slo_title: "Care of the Physically Ill Patient", cap_title: "Airway management" },
    { slo: 1, cap: 2, slo_title: "Care of the Physically Ill Patient", cap_title: "Breathing assessment" },
  ],
  Cardiology: [
    { slo: 2, cap: 1, slo_title: "Decision Making", cap_title: "ACS pathways" },
    { slo: 2, cap: 2, slo_title: "Decision Making", cap_title: "Arrhythmia management" },
  ],
  Respiratory: [
    { slo: 1, cap: 3, slo_title: "Care of the Physically Ill Patient", cap_title: "Hypoxia management" },
  ],
  Neurology: [
    { slo: 3, cap: 1, slo_title: "Clinical Complexity", cap_title: "Stroke and seizures" },
  ],
  "Gastro/Hepato": [
    { slo: 3, cap: 2, slo_title: "Clinical Complexity", cap_title: "GI bleeding" },
  ],
  "Renal/Urology": [
    { slo: 3, cap: 3, slo_title: "Clinical Complexity", cap_title: "AKI and obstruction" },
  ],
  Endocrine: [
    { slo: 1, cap: 4, slo_title: "Care of the Physically Ill Patient", cap_title: "DKA and HHS" },
  ],
  "Infectious Disease": [
    { slo: 1, cap: 5, slo_title: "Care of the Physically Ill Patient", cap_title: "Sepsis recognition" },
  ],
  Toxicology: [
    { slo: 4, cap: 1, slo_title: "Patient Safety", cap_title: "Poisoning management" },
  ],
  Trauma: [
    { slo: 5, cap: 1, slo_title: "Managing Incidents", cap_title: "Trauma ABCDE" },
  ],
};

const COVERAGE_PLAN: Array<{ system: string; topic: string; count: number }> = [
  { system: "Resuscitation", topic: "Airway", count: 10 },
  { system: "Cardiology", topic: "ACS", count: 12 },
  { system: "Respiratory", topic: "Asthma/COPD", count: 10 },
  { system: "Neurology", topic: "Stroke/Seizure", count: 8 },
  { system: "Gastro/Hepato", topic: "UGIB/LFTs", count: 6 },
  { system: "Renal/Urology", topic: "AKI/Colic", count: 6 },
  { system: "Endocrine", topic: "Diabetes", count: 6 },
  { system: "Infectious Disease", topic: "Sepsis", count: 8 },
  { system: "Toxicology", topic: "Overdose", count: 7 },
  { system: "Trauma", topic: "MSK/Head", count: 7 },
];

const DIFFICULTY_BUCKETS = (i: number): "easy" | "medium" | "hard" => {
  // 30% easy, 50% medium, 20% hard
  const r = (i % 10) / 10; // deterministic-ish
  if (r < 0.3) return "easy";
  if (r < 0.8) return "medium";
  return "hard";
};

const EXAM_BY_INDEX = (i: number): "MRCEM_SBA" | "FRCEM_SBA" => (i % 2 === 0 ? "MRCEM_SBA" : "FRCEM_SBA");

function buildQuestion(i: number, system: string, topic: string) {
  const diff = DIFFICULTY_BUCKETS(i);
  const exam = EXAM_BY_INDEX(i);
  const stem = `Q${i + 1}: [${system} / ${topic}] A typical ED scenario—what is the next best step?`;
  const options = [
    "A. Perform the guideline-recommended intervention",
    "B. Observe and reassess later",
    "C. Start broad empirical therapy",
    "D. Discharge with safety-netting",
  ];
  const correctLetter = "A";
  const explanation = `Follow best-practice ED algorithms for ${system} (${topic}); ${exam} standard.`;
  return { exam, diff, stem, options, correctLetter, explanation };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabaseService.auth.getUser(token);
    if (authErr) throw authErr;
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabaseService.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ensure >=3 gurus by promoting existing users if needed
    const { data: gurusNow } = await supabaseService.from("user_roles").select("user_id").eq("role", "guru");
    let guruIds = (gurusNow || []).map((r: any) => r.user_id as string);

    if (guruIds.length < 3) {
      const { data: candidates } = await supabaseService
        .from("profiles")
        .select("user_id")
        .neq("user_id", user.id)
        .limit(5);
      const toPromote = (candidates || [])
        .map((c: any) => c.user_id as string)
        .filter((id) => !guruIds.includes(id))
        .slice(0, 3 - guruIds.length);
      for (const id of toPromote) {
        await supabaseService.from("user_roles").insert({ user_id: id, role: "guru" }).select().maybeSingle();
        guruIds.push(id);
      }
      if (guruIds.length === 0) guruIds = [user.id]; // fallback: admin acts as reviewer
    }

    // Build question set
    const batch: any[] = [];
    const reviewBatch: any[] = [];
    const meta: Array<{ sys: string; topic: string; idx: number }> = [];
    let createdCount = 0, skipped = 0;

    let counter = 0;
    for (const blk of COVERAGE_PLAN) {
      for (let k = 0; k < blk.count; k++) {
        const i = counter++;
        const q = buildQuestion(i, blk.system, blk.topic);
        meta.push({ sys: blk.system, topic: blk.topic, idx: i });
        batch.push({
          question_text: q.stem,
          option_a: q.options[0].slice(3),
          option_b: q.options[1].slice(3),
          option_c: q.options[2].slice(3),
          option_d: q.options[3].slice(3),
          correct_answer: q.correctLetter,
          explanation: q.explanation,
          topic: `${blk.system}: ${blk.topic}`,
          exam_type: q.exam,
          difficulty_level: q.diff,
          created_by: user.id,
          reviewed_by: guruIds[i % guruIds.length],
          status: "approved",
          is_ai_generated: false,
        });
        reviewBatch.push({
          question: q.stem,
          options: q.options,
          correct_answer: q.correctLetter,
          explanation: q.explanation,
          exam_type: q.exam,
          topic: `${blk.system}: ${blk.topic}`,
          created_by: user.id,
          status: "draft",
        });
      }
    }

    // Idempotency: check existing stems in questions
    const stems = batch.map((b) => b.question_text);
    const { data: existing } = await supabaseService
      .from("questions")
      .select("id, question_text")
      .in("question_text", stems);
    const existingSet = new Set((existing || []).map((e: any) => e.question_text as string));

    const toInsertMain = batch.filter((b) => !existingSet.has(b.question_text));
    const insertedQuestions: any[] = [];
    if (toInsertMain.length) {
      const { data: inserted, error } = await supabaseService.from("questions").insert(toInsertMain).select("*");
      if (error) throw error;
      insertedQuestions.push(...(inserted || []));
      createdCount += inserted?.length || 0;
    }
    skipped = stems.length - toInsertMain.length;

    // Mirror into review_exam_questions for workflow (idempotent by stem)
    const { data: existingReview } = await supabaseService
      .from("review_exam_questions")
      .select("id, question")
      .in("question", stems);
    const existRev = new Set((existingReview || []).map((r: any) => r.question as string));
    const toInsertReview = reviewBatch.filter((r) => !existRev.has(r.question));
    let reviewRows: any[] = [];
    if (toInsertReview.length) {
      const { data: insRev, error: rErr } = await supabaseService.from("review_exam_questions").insert(toInsertReview).select("*");
      if (rErr) throw rErr;
      reviewRows = insRev || [];
    } else {
      reviewRows = existingReview || [];
    }

    // Assign reviewers and feedback
    let assignments = 0;
    for (let i = 0; i < reviewRows.length; i++) {
      const rq = reviewRows[i];
      const reviewer1 = guruIds[i % guruIds.length];
      const assign = await supabaseService.from("review_assignments").insert({ question_id: rq.id, guru_id: reviewer1 }).select("*").maybeSingle();
      if (!assign.error && assign.data) {
        assignments += 1;
        await supabaseService.from("review_feedback").insert({
          assignment_id: assign.data.id,
          guru_id: reviewer1,
          approved: true,
          stars: 4 + ((i % 2) as 0 | 1),
          feedback: "Looks good for exam prep.",
        });
      }
      // Optional second reviewer for diversity
      if (guruIds.length > 1 && i % 3 === 0) {
        const reviewer2 = guruIds[(i + 1) % guruIds.length];
        const assign2 = await supabaseService.from("review_assignments").insert({ question_id: rq.id, guru_id: reviewer2 }).select("*").maybeSingle();
        if (!assign2.error && assign2.data) {
          assignments += 1;
          await supabaseService.from("review_feedback").insert({
            assignment_id: assign2.data.id,
            guru_id: reviewer2,
            approved: true,
            stars: 4,
            feedback: "Approved.",
          });
        }
      }
    }

    // Curriculum upsert + link to main questions
    const qMapByStem = new Map<string, any>();
    for (const q of insertedQuestions) qMapByStem.set(q.question_text, q);

    for (let i = 0; i < meta.length; i++) {
      const stem = batch[i].question_text;
      const mainRow = qMapByStem.get(stem);
      if (!mainRow) continue; // already existed earlier
      const system = meta[i].sys;
      const exam = EXAM_BY_INDEX(i);
      const caps = SYSTEM_TO_CURRICULUM[system] || [];
      for (const cap of caps.slice(0, 1)) { // link 1 capability per question
        const { data: curri, error: cErr } = await supabaseService
          .from("curriculum_map")
          .insert({
            exam_type: exam,
            slo_number: cap.slo,
            slo_title: cap.slo_title,
            key_capability_number: cap.cap,
            key_capability_title: cap.cap_title,
          })
          .select("*");
        let curriId: string | null = null;
        if (cErr && !String(cErr.message || "").includes("duplicate")) {
          console.error("curriculum insert error", cErr);
        }
        if (curri && curri[0]) {
          curriId = curri[0].id;
        } else {
          // try to find existing
          const { data: findCur } = await supabaseService
            .from("curriculum_map")
            .select("id")
            .eq("exam_type", exam)
            .eq("slo_number", cap.slo)
            .eq("key_capability_number", cap.cap)
            .limit(1);
          curriId = findCur?.[0]?.id ?? null;
        }
        if (curriId) {
          await supabaseService.from("question_curriculum_map").insert({ question_id: mainRow.id, curriculum_id: curriId }).then(() => {}).catch(() => {});
        }
      }
    }

    const result: SeedResult = { inserted: createdCount, assignments, reviewers: guruIds.length, skipped };
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-reviewed-questions error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
