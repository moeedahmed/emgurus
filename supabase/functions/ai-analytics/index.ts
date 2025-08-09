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
  // Simple totals and last 7d usage
  const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const { count: msgCount } = await supabase.from('ai_messages').select('*', { count: 'exact', head: true }).gte('created_at', since);
  const { count: sessCount } = await supabase.from('ai_sessions').select('*', { count: 'exact', head: true }).gte('created_at', since);
  const { count: fbCount } = await supabase.from('ai_feedback').select('*', { count: 'exact', head: true }).gte('created_at', since);
  return new Response(JSON.stringify({ last7d: { messages: msgCount || 0, sessions: sessCount || 0, feedback: fbCount || 0 } }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});