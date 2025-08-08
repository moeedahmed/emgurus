import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ActionBody =
  | { action: "admin_create_question"; payload: { question: string; options: any; correct_answer: string; explanation?: string; topic?: string; exam_type: string } }
  | { action: "admin_assign"; payload: { question_id: string; guru_id: string } }
  | { action: "guru_feedback"; payload: { assignment_id: string; approved: boolean; stars?: number; feedback?: string } }
  | { action: "admin_publish"; payload: { question_id: string } };

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

    // Resolve roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleList: string[] = (roles || []).map((r: any) => r.role);
    const isAdmin = roleList.includes("admin");
    const isGuru = roleList.includes("guru");

    const body = (await req.json()) as ActionBody;

    switch (body.action) {
      case "admin_create_question": {
        if (!isAdmin) throw new Error("Forbidden: admin only");
        const { question, options, correct_answer, explanation, topic, exam_type } = body.payload;
        const { data, error } = await supabase
          .from("review_exam_questions")
          .insert({ created_by: user.id, question, options, correct_answer, explanation, topic, exam_type })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ question: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      case "admin_assign": {
        if (!isAdmin) throw new Error("Forbidden: admin only");
        const { question_id, guru_id } = body.payload;
        const { data, error } = await supabase
          .from("review_assignments")
          .insert({ question_id, guru_id })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ assignment: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      case "guru_feedback": {
        if (!isGuru) throw new Error("Forbidden: guru only");
        const { assignment_id, approved, stars, feedback } = body.payload;
        // Ensure assignment belongs to this guru
        const { data: a, error: aErr } = await supabase
          .from("review_assignments")
          .select("id, guru_id")
          .eq("id", assignment_id)
          .single();
        if (aErr) throw aErr;
        if (a.guru_id !== user.id) throw new Error("Forbidden: not your assignment");

        const { data, error } = await supabase
          .from("review_feedback")
          .insert({ assignment_id, guru_id: user.id, approved, stars, feedback })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ feedback: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      case "admin_publish": {
        if (!isAdmin) throw new Error("Forbidden: admin only");
        const { question_id } = body.payload;
        const { error: uErr } = await supabase
          .from("review_exam_questions")
          .update({ status: "published" })
          .eq("id", question_id);
        if (uErr) throw uErr;
        const { data: log, error: lErr } = await supabase
          .from("review_publish_log")
          .insert({ question_id, published_by: user.id })
          .select("*")
          .single();
        if (lErr) throw lErr;
        return new Response(JSON.stringify({ published: true, log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      default:
        throw new Error("Unknown action");
    }
  } catch (e) {
    console.error("review-exams-api error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
