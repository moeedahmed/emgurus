import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GenInput = {
  exam: string;
  topic?: string;
  count?: number; // <= 5
};

type GenItem = {
  stem: string;
  options: string[];
  correct_index: number; // 0..3
  explanation: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENABLE_AI_QGEN = (Deno.env.get("ENABLE_AI_QGEN") || "false").toLowerCase() === "true";
    if (!ENABLE_AI_QGEN) {
      return new Response(
        JSON.stringify({ error: "AI generator disabled. Set ENABLE_AI_QGEN=true to enable." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as GenInput;
    const exam = body.exam?.toString().trim();
    const topic = body.topic?.toString().trim();
    let count = Number(body.count || 3);
    if (!exam) {
      return new Response(JSON.stringify({ error: "exam is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Number.isNaN(count) || count < 1) count = 1;
    if (count > 5) count = 5;

    const prompt = `Create ${count} MRCEM-style multiple choice questions for exam ${exam}${topic ? ` on topic ${topic}` : ''}.
Return STRICT JSON with shape: {"questions":[{"stem":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"..."}]}.
- options MUST be length 4
- correct_index MUST be 0..3
- Keep stems concise and clinical.
`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You create high-quality exam questions. Respond ONLY with valid JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("OpenAI error", err);
      return new Response(JSON.stringify({ error: "OpenAI request failed", details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content || "{}";
    let parsed: { questions?: GenItem[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON", content);
      return new Response(JSON.stringify({ error: "Model did not return JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = (parsed.questions || []).slice(0, count).filter((q) =>
      q && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct_index === "number"
    );

    if (!questions.length) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inserts = questions.map((q) => ({
      exam,
      topic: topic || null,
      subtopic: null,
      stem: q.stem,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      reviewer_id: null,
      reviewed_at: null,
      status: "pending",
    }));

    const { data: inserted, error } = await supabase
      .from("reviewed_exam_questions")
      .insert(inserts)
      .select("id");

    if (error) {
      console.error("Insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ inserted: inserted?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-generate-questions error", err);
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});