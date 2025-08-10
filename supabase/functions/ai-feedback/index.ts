import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    // Require valid JWT
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { session_id, message_id, rating, comment } = await req.json();
    if (!session_id || typeof rating === 'undefined') {
      return new Response(JSON.stringify({ error: 'Missing session_id or rating' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Verify the session belongs to the authenticated user
    const { data: sessionRow, error: sErr } = await admin
      .from('ai_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sessionRow || sessionRow.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const safeRating = Math.max(-1, Math.min(1, Math.sign(Number(rating)) || 1));
    const row = { session_id, message_id: message_id || null, rating: safeRating, comment: comment || null };
    const { error } = await admin.from('ai_feedback').insert(row as any);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('ai-feedback error', err);
    const status = 500;
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});