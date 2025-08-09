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
      const { examType } = body as StartSessionBody;
      const ALLOWED = ["MRCEM Primary", "MRCEM Intermediate SBA", "FRCEM SBA"];
      if (!ALLOWED.includes(examType)) {
        throw new Error("Invalid exam type. Allowed: MRCEM Primary, MRCEM Intermediate SBA, FRCEM SBA");
      }
      const { data, error } = await supabase
        .from("ai_exam_sessions")
        .insert({ user_id: user.id, exam_type: examType })
        .select("*")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "generate_question") {
      const { session_id, topic: preferredTopic } = body as GenerateQuestionBody & { count?: number };

      // Verify session ownership
      const { data: session, error: sErr } = await supabase
        .from("ai_exam_sessions")
        .select("id, user_id, exam_type")
        .eq("id", session_id)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) throw new Error("Session not found");
      if (session.user_id !== user.id) throw new Error("Forbidden: not your session");

      // Determine topic bias from past answers (fallback to preferredTopic)
      const { data: past, error: pErr } = await supabase
        .from("ai_exam_answers")
        .select("is_correct, question_id")
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      const qIds = (past ?? []).map((p: any) => p.question_id);
      let topicToUse: string | undefined = preferredTopic && preferredTopic !== "All areas" ? preferredTopic : undefined;
      if (!topicToUse && qIds.length) {
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
        if (worst && worst.rate >= 0.4) topicToUse = worst.topic;
      }

      const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAIApiKey) throw new Error("OPENAI_API_KEY not configured");

      const modelEnv = (Deno.env.get("OPENAI_MODEL_CHAT") || "").trim();
      const candidates = [modelEnv, "gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"].filter(Boolean) as string[];
      const countForLog = (body as any).count ?? null;

      const systemPrompt = `You are a medical education expert writing Emergency Medicine MCQs. Return strict JSON only.`;
      const userPrompt = `Generate one MCQ for ${session.exam_type}.
Constraints:
- Topic focus: ${topicToUse ?? "random across the EM curriculum"}
- 5 options (A–E), exactly one correct
- Concise, high-yield explanation
- Add a short credible reference hint (e.g., NICE/RCEM/UpToDate)
- Avoid repeating stems from past questions; vary phrasing

Return ONLY this JSON schema:
{
  "question": "string",
  "options": { "A": "string", "B": "string", "C": "string", "D": "string", "E": "string" },
  "correct": "A"|"B"|"C"|"D"|"E",
  "explanation": "string",
  "reference": "string",
  "topic": "string",
  "subtopic": "string"
}`;

      async function tryResponses(model: string): Promise<string> {
        // Debug one-liner (no secrets)
        console.log(JSON.stringify({ model_used: model, where: "AI Practice" }));
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, temperature: 0.4, input: [ { role: "system", content: systemPrompt }, { role: "user", content: userPrompt } ] })
        });
        if (!r.ok) throw new Error(`responses_${r.status}`);
        const data = await r.json();
        const text = data.output_text
          ?? data?.output?.[0]?.content?.[0]?.text
          ?? data?.data?.[0]?.content?.[0]?.text
          ?? undefined;
        if (!text) throw new Error("responses_no_text");
        return text as string;
      }

      async function tryChat(model: string): Promise<string> {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ]
          })
        });
        if (!r.ok) throw new Error(`chat_${r.status}`);
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error("chat_no_text");
        return text as string;
      }

      async function getJsonWithFallback(model: string): Promise<any> {
        let text: string | undefined;
        // Try Responses API first, then fallback to Chat
        try { text = await tryResponses(model); } catch (_) { text = await tryChat(model); }
        try {
          return JSON.parse(text!);
        } catch (_) {
          // Retry once with a stricter instruction
          const fixPrompt = `${userPrompt}\nIMPORTANT: Return ONLY valid JSON matching the schema. No prose.`;
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: fixPrompt }
              ]
            })
          });
          if (!r.ok) throw new Error(`chat_${r.status}`);
          const d = await r.json();
          const t = d.choices?.[0]?.message?.content;
          return JSON.parse(t);
        }
      }

      let lastErr: any = null;
      for (const m of candidates) {
        try {
          const obj = await getJsonWithFallback(m);
          // Normalize options to array [A..E]
          const optionsObj = obj.options || {};
          const optionsArr = Array.isArray(optionsObj)
            ? optionsObj
            : ["A","B","C","D","E"].map((k) => optionsObj[k] ?? optionsObj[`${k}.`] ?? "");

          const insert = {
            session_id,
            question: obj.question,
            options: optionsArr,
            correct_answer: obj.correct || obj.correct_answer,
            explanation: obj.explanation,
            source: obj.reference || obj.source,
            topic: obj.topic,
            subtopic: obj.subtopic
          };
          const { data: saved, error: iErr } = await supabase
            .from("ai_exam_questions")
            .insert(insert)
            .select("*")
            .single();
          if (iErr) throw iErr;

          // Log success
          await supabase.from("ai_gen_logs").insert({
            user_id: user.id,
            source: "ai_practice",
            exam: session.exam_type,
            slo: topicToUse ?? preferredTopic ?? null,
            count: countForLog,
            model_used: m,
            success: true,
            error_code: null
          });

          return new Response(JSON.stringify({ question: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
          lastErr = err;
          // log failure and try next candidate
          await supabase.from("ai_gen_logs").insert({
            user_id: user.id,
            source: "ai_practice",
            exam: session.exam_type,
            slo: topicToUse ?? preferredTopic ?? null,
            count: countForLog,
            model_used: m,
            success: false,
            error_code: String(err?.message ?? err)
          });
          continue;
        }
      }

      throw new Error(`Model unavailable. Set OPENAI_MODEL_CHAT in Supabase secrets. Last error: ${String(lastErr)}`);
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
