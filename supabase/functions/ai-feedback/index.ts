import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { session_id, message_id, rating, comment } = await req.json();
    if (!session_id || !rating) {
      return new Response(JSON.stringify({ error: 'Missing session_id or rating' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const row = { session_id, message_id: message_id || null, rating: Math.sign(Number(rating)) || 1, comment: comment || null };
    const { error } = await supabase.from('ai_feedback').insert(row as any);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('ai-feedback error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});