import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getOpenAI, chat } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StartSessionBody = { action: "start_session"; examType: string };
type GenerateQuestionBody = { action: "generate_question"; session_id: string; curriculum_ids?: string[]; topic?: string; count?: number };
type SubmitAnswerBody = { action: "submit_answer"; question_id: string; selected_answer: string; feedback?: "none"|"too_easy"|"hallucinated"|"wrong"|"not_relevant" };
type BulkGenerateBody = { action: "bulk_generate"; exam_type: string; topic?: string; topic_id?: string; difficulty?: string; count?: number; persistAsDraft?: boolean; reviewer_assign_to?: string[]; preGenerated?: any };
type PracticeGenerateBody = { action: "practice_generate"; exam_type: string; topic?: string; difficulty?: string; count?: number };

type RequestBody = StartSessionBody | GenerateQuestionBody | SubmitAnswerBody | BulkGenerateBody | PracticeGenerateBody;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Check OpenAI key first
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return new Response(JSON.stringify({ success: false, error: "OpenAI key not configured" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

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

    let body;
    try {
      body = (await req.json()) as RequestBody;
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON payload" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Add structured validation for bulk_generate and practice_generate actions
    if (body.action === "bulk_generate" || body.action === "practice_generate") {
      const { exam_type, count = 1 } = body as BulkGenerateBody | PracticeGenerateBody;
      const errors: { field: string; message: string }[] = [];
      
      if (!exam_type || typeof exam_type !== 'string') {
        errors.push({ field: "exam_type", message: "Exam type is required" });
      }
      
      const maxCount = body.action === "practice_generate" ? 1 : 20;
      if (typeof count !== 'number' || count < 1 || count > maxCount) {
        errors.push({ field: "count", message: `Count must be between 1 and ${maxCount}` });
      }
      
      if (errors.length > 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          errors,
          message: `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
        }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

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
      return new Response(JSON.stringify({ success: true, session: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      try {
        getOpenAI();
      } catch (error) {
        throw new Error("OpenAI key not configured");
      }

      const modelEnv = Deno.env.get("OPENAI_MODEL_EXAM") || Deno.env.get("OPENAI_MODEL_CHAT") || "gpt-4o-mini";
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

      console.log('AI Exams - model:', modelEnv, 'exam:', session.exam_type, 'topic:', topicToUse);

      try {
        const result = await chat({
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          model: modelEnv,
          responseFormat: 'json_object',
          temperature: 0.4,
          maxTokens: 800
        });

        const obj = JSON.parse(result);
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
          model_used: modelEnv,
          success: true,
          error_code: null
        });

        return new Response(JSON.stringify({ success: true, question: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err: any) {
        // Log failure
        await supabase.from("ai_gen_logs").insert({
          user_id: user.id,
          source: "ai_practice",
          exam: session.exam_type,
          slo: topicToUse ?? preferredTopic ?? null,
          count: countForLog,
          model_used: modelEnv,
          success: false,
          error_code: String(err?.message ?? err)
        });
        throw new Error(`AI generation failed: ${String(err?.message ?? err)}`);
      }
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

      return new Response(JSON.stringify({ success: true, result: { is_correct }, answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "bulk_generate") {
      const { exam_type, topic, topic_id, difficulty, count = 5, persistAsDraft = true, reviewer_assign_to, searchOnline = false, files = [], urls = [], preGenerated } = body as BulkGenerateBody & { 
        searchOnline?: boolean; 
        files?: Array<{ name: string; content: string; type: string }>; 
        urls?: string[];
        preGenerated?: { question: string; options: string[]; correct: string; explanation?: string; reference?: string; }
      };
      
      // Resolve topic from topic_id if provided
      let topicTitle = topic;
      if (topic_id) {
        try {
          const { data: topicData } = await supabase
            .from('curriculum_map')
            .select('slo_title')
            .eq('id', topic_id)
            .single();
          if (topicData) {
            topicTitle = topicData.slo_title;
          }
        } catch (err) {
          console.error('Failed to resolve topic_id:', err);
        }
      }
      
      // Check if user is admin or guru
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = (roles || []).map((r: any) => r.role);
      const isAdmin = userRoles.includes('admin');
      const isGuru = userRoles.includes('guru');
      
      if (!isAdmin && !isGuru) {
        throw new Error("Unauthorized: admin or guru role required");
      }

      const maxCount = isAdmin ? 20 : 10;
      const safeCount = Math.max(1, Math.min(maxCount, count));

      try {
        getOpenAI();
      } catch (error) {
        throw new Error("OpenAI key not configured");
      }

      // Process uploaded files and URLs for content enrichment
      let additionalContext = "";
      
      // Parse files (PDF/DOCX/TXT)
      for (const file of files || []) {
        try {
          if (file.type === 'text/plain') {
            additionalContext += `\n\nFile Content (${file.name}):\n${file.content}`;
          } else if (file.type === 'application/pdf') {
            // Simple text extraction - in production, use proper PDF parser
            additionalContext += `\n\nPDF Content (${file.name}):\n${file.content}`;
          } else if (file.type.includes('document')) {
            // Simple DOCX extraction - in production, use proper DOCX parser
            additionalContext += `\n\nDocument Content (${file.name}):\n${file.content}`;
          }
        } catch (err) {
          console.error(`Failed to parse file ${file.name}:`, err);
        }
      }

      // Scrape URLs
      for (const url of urls || []) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            // Basic HTML cleaning
            const cleanText = text
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]*>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 5000); // Limit content length
            
            additionalContext += `\n\nURL Content (${url}):\n${cleanText}`;
          }
        } catch (err) {
          console.error(`Failed to scrape URL ${url}:`, err);
        }
      }

      // Online search enrichment
      if (searchOnline && topic) {
        try {
          // Placeholder for web search - integrate with search API
          additionalContext += `\n\nOnline Search Results for "${topic}":\n[Search integration needed]`;
        } catch (err) {
          console.error("Online search failed:", err);
        }
      }

      const generated = [];
      const model = Deno.env.get("OPENAI_MODEL_EXAM") || "gpt-4o-mini";

      for (let i = 0; i < safeCount; i++) {
        try {
          let obj: any;

          // Use pre-generated content if provided (from Exam Generator)
          if (preGenerated && i === 0) {
            obj = {
              question: preGenerated.question,
              options: Array.isArray(preGenerated.options) 
                ? { A: preGenerated.options[0], B: preGenerated.options[1], C: preGenerated.options[2], D: preGenerated.options[3], E: preGenerated.options[4] }
                : preGenerated.options,
              correct: preGenerated.correct,
              explanation: preGenerated.explanation || '',
              reference: preGenerated.reference || '',
              topic: topic || 'General',
              subtopic: topic || 'General'
            };
          } else {
            const systemPrompt = `You are a medical education expert writing Emergency Medicine MCQs. Return strict JSON only.`;
            const userPrompt = `Generate one MCQ for ${exam_type}.
Constraints:
- Topic focus: ${topicTitle || "random across the EM curriculum"}
- Difficulty: ${difficulty || "mixed"}
- 5 options (A–E), exactly one correct
- Concise, high-yield explanation
- Add a short credible reference hint (e.g., NICE/RCEM/UpToDate)
${additionalContext ? `\n\nAdditional Context (use as reference):\n${additionalContext.slice(0, 2000)}` : ''}

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

            const result = await chat({
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
              model,
              responseFormat: 'json_object',
              temperature: 0.4,
              maxTokens: 800
            });

            obj = JSON.parse(result);
          }
          
          // Validate generated content - drop empty or malformed questions
          if (!obj.question || !obj.options || !obj.correct || !obj.explanation) {
            console.warn(`Dropping malformed question ${i + 1}:`, obj);
            continue;
          }
          
          if (persistAsDraft) {
            // Insert into review_exam_questions as draft
            const { data: saved, error: iErr } = await supabase
              .from("review_exam_questions")
              .insert({
                question: obj.question,
                options: obj.options,
                correct_answer: obj.correct || obj.correct_answer,
                explanation: obj.explanation,
                exam_type: exam_type,
                created_by: user.id,
                status: 'draft',
                submitted_at: persistAsDraft ? new Date().toISOString() : null
              })
              .select("*")
              .single();
            
            if (iErr) throw iErr;
            generated.push(saved);

            // Create assignments if reviewers specified (support multi-reviewer)
            if (reviewer_assign_to && Array.isArray(reviewer_assign_to) && reviewer_assign_to.length > 0 && saved) {
              const assignments = reviewer_assign_to.map(reviewerId => ({
                question_id: saved.id,
                reviewer_id: reviewerId,
                assigned_by: user.id,
                status: 'pending_review',
                assigned_at: new Date().toISOString(),
                notes: `Auto-assigned via ${preGenerated ? 'Exam Generator' : 'bulk generation'}`
              }));

              const { error: assignError } = await supabase
                .from("exam_review_assignments")
                .insert(assignments);

              if (assignError) {
                console.error('Assignment error:', assignError);
                // Don't fail the whole operation for assignment errors
              } else {
                // Update question metadata only if assignment succeeded
                await supabase
                  .from("review_exam_questions")
                  .update({
                    status: 'under_review',
                    assigned_by: user.id,
                    assigned_at: new Date().toISOString()
                  })
                  .eq('id', saved.id);
              }
            } else if (reviewer_assign_to && typeof reviewer_assign_to === 'string' && saved) {
              // Legacy single reviewer support
              const { error: assignError } = await supabase
                .from("exam_review_assignments")
                .insert({
                  question_id: saved.id,
                  reviewer_id: reviewer_assign_to,
                  assigned_by: user.id,
                  status: 'pending_review',
                  assigned_at: new Date().toISOString(),
                  notes: `Auto-assigned via ${preGenerated ? 'Exam Generator' : 'bulk generation'}`
                });

              if (assignError) {
                console.error('Assignment error:', assignError);
                // Don't fail the whole operation for assignment errors
              } else {
                // Update question metadata only if assignment succeeded
                await supabase
                  .from("review_exam_questions")
                  .update({
                    status: 'under_review',
                    assigned_by: user.id,
                    assigned_at: new Date().toISOString()
                  })
                  .eq('id', saved.id);
              }
            }
          } else {
            generated.push(obj);
          }
        } catch (err: any) {
          console.error(`Failed to generate question ${i + 1}:`, err);
        }
      }

      // Log bulk generation
      await supabase.from("ai_gen_logs").insert({
        user_id: user.id,
        source: "admin_bulk",
        exam: exam_type,
        slo: topicTitle || topic || null,
        count: safeCount,
        model_used: model,
        success: generated.length > 0,
        error_code: generated.length === 0 ? "all_failed" : null
      });

      // Return consistent schema with success field
      if (generated.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Failed to generate any valid questions. Please try again with different parameters.",
          items: [],
          count: 0,
          requested: safeCount
        }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        items: generated, 
        count: generated.length,
        requested: safeCount 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "practice_generate") {
      const { exam_type, topic, difficulty, count = 1 } = body as PracticeGenerateBody;
      
      // No role restriction for practice - anyone can use it
      try {
        getOpenAI();
      } catch (error) {
        throw new Error("OpenAI key not configured");
      }

      const generated = [];
      const model = Deno.env.get("OPENAI_MODEL_EXAM") || Deno.env.get("OPENAI_MODEL_CHAT") || "gpt-4o-mini";

      for (let i = 0; i < count; i++) {
        try {
          const systemPrompt = `You are a medical education expert writing Emergency Medicine MCQs. Return strict JSON only.`;
          const userPrompt = `Generate one MCQ for ${exam_type}.
Constraints:
- Topic focus: ${topic || "random across the EM curriculum"}
- Difficulty: ${difficulty || "medium"}
- 5 options (A–E), exactly one correct
- Concise, high-yield explanation
- Add a short credible reference hint (e.g., NICE/RCEM/UpToDate)

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

          const result = await chat({
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            model,
            responseFormat: 'json_object',
            maxTokens: 800
          });

          const obj = JSON.parse(result);
          generated.push(obj);
        } catch (err: any) {
          console.error(`Failed to generate question ${i + 1}:`, err);
        }
      }

      // Log practice generation
      await supabase.from("ai_gen_logs").insert({
        user_id: user.id,
        source: "ai_practice",
        exam: exam_type,
        slo: topic || null,
        count: count,
        model_used: model,
        success: generated.length > 0,
        error_code: generated.length === 0 ? "all_failed" : null
      });

      // Always return structured response with success/error
      if (generated.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Failed to generate any valid questions. Please try again with different parameters.",
          items: [],
          count: 0,
          requested: count
        }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        items: generated, 
        count: generated.length,
        requested: count 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e) {
    console.error("ai-exams-api error", e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(e?.message ?? e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
