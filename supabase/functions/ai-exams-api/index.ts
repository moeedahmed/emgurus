import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StartSessionBody = { action: "start_session"; examType: string };
type GenerateQuestionBody = { action: "generate_question"; session_id: string; curriculum_ids?: string[]; topic?: string };
type SubmitAnswerBody = { action: "submit_answer"; question_id: string; selected_answer: string; feedback?: "none"|"too_easy"|"hallucinated"|"wrong"|"not_relevant" };

type RequestBody = StartSessionBody | GenerateQuestionBody | SubmitAnswerBody;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw userErr;
    if (!user) throw new Error("User not authenticated");

    const body = (await req.json()) as RequestBody;

    if (body.action === "start_session") {
      const { examType } = body;
      const { data, error } = await supabase
        .from("ai_exam_sessions")
        .insert({ user_id: user.id, exam_type: examType })
        .select("*")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "generate_question") {
      const { session_id, topic: preferredTopic } = body;

      // Verify session ownership
      const { data: session, error: sErr } = await supabase
        .from("ai_exam_sessions")
        .select("id, user_id, exam_type")
        .eq("id", session_id)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) throw new Error("Session not found");
      if (session.user_id !== user.id) throw new Error("Forbidden: not your session");

      // Find weak topic from past answers (fallback to preferredTopic)
      const { data: past, error: pErr } = await supabase
        .from("ai_exam_answers")
        .select("is_correct, question_id")
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      const qIds = (past ?? []).map((p: any) => p.question_id);
      let weakTopic: string | undefined = preferredTopic;
      if (qIds.length) {
        const { data: qMeta } = await supabase
          .from("ai_exam_questions")
          .select("id, topic")
          .in("id", qIds);
        const topicStats = new Map<string, { wrong: number; total: number }>();
        (past || []).forEach((a: any) => {
          const t = qMeta?.find((q: any) => q.id === a.question_id)?.topic;
          if (!t) return;
          const stat = topicStats.get(t) || { wrong: 0, total: 0 };
          stat.total += 1; if (!a.is_correct) stat.wrong += 1;
          topicStats.set(t, stat);
        });
        let worst: { topic: string; rate: number } | undefined;
        for (const [t, s] of topicStats.entries()) {
          const rate = s.total ? s.wrong / s.total : 0;
          if (!worst || rate > worst.rate) worst = { topic: t, rate };
        }
        if (worst && worst.rate >= 0.4) weakTopic = worst.topic; // bias to weak areas
      }

      const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAIApiKey) throw new Error("OPENAI_API_KEY not configured");

      const prompt = `Generate a high-quality medical MCQ strictly as JSON.\n\nRequirements:\n- Target exam type: ${session.exam_type}\n- Preferred topic: ${weakTopic ?? "any core EM topic"}\n- 4 options (A-D) with one correct answer\n- Provide a concise but educational explanation\n- Include credible sources (e.g., NICE, RCEMLearning, UpToDate)\n- Avoid previously seen phrasing; vary stems and options\n\nReturn ONLY valid JSON with keys: question, options (array of 4 strings with A-D labels), correct_answer (A-D), explanation, source (string), topic, subtopic.`;

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: "You are a cautious medical question writer. Always return valid JSON only." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!resp.ok) throw new Error(`OpenAI error ${resp.status}`);
      const json = await resp.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("No content from OpenAI");

      let q;
      try { q = JSON.parse(content); } catch { throw new Error("AI did not return JSON"); }

      const insert = {
        session_id,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        source: q.source,
        topic: q.topic,
        subtopic: q.subtopic
      };
      const { data: saved, error: iErr } = await supabase
        .from("ai_exam_questions")
        .insert(insert)
        .select("*")
        .single();
      if (iErr) throw iErr;

      return new Response(JSON.stringify({ question: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "submit_answer") {
      const { question_id, selected_answer, feedback } = body;
      // Load question to compute correctness
      const { data: q, error: qErr } = await supabase
        .from("ai_exam_questions")
        .select("id, correct_answer")
        .eq("id", question_id)
        .single();
      if (qErr) throw qErr;
      const is_correct = (selected_answer || "").trim().toUpperCase() === (q.correct_answer || "").trim().toUpperCase();

      const { data: answer, error: aErr } = await supabase
        .from("ai_exam_answers")
        .insert({ question_id, user_id: user.id, selected_answer, is_correct, feedback: (feedback ?? "none") })
        .select("*")
        .single();
      if (aErr) throw aErr;

      return new Response(JSON.stringify({ result: { is_correct }, answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e) {
    console.error("ai-exams-api error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
