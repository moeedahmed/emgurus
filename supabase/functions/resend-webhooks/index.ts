import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const payload = await req.json();

    // TODO: Verify signature if WEBHOOK_SECRET is provided (implementation depends on Resend's current webhook format)
    if (!WEBHOOK_SECRET) {
      console.warn('RESEND_WEBHOOK_SECRET not set. Events are not verified.');
    }

    const type: string = payload?.type || payload?.event || '';
    const data = payload?.data || payload || {};
    const email = data?.to || data?.email || data?.recipient || data?.to_email || null;
    const providerId = data?.id || data?.message_id || null;

    if (!type || !email) {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let event: 'delivered'|'opened'|'clicked'|'bounced'|'complained'|'failed'|'sent' = 'sent';
    const t = type.toLowerCase();
    if (t.includes('delivered')) event = 'delivered';
    else if (t.includes('open')) event = 'opened';
    else if (t.includes('click')) event = 'clicked';
    else if (t.includes('bounce')) event = 'bounced';
    else if (t.includes('complain')) event = 'complained';
    else if (t.includes('fail') || t.includes('error')) event = 'failed';
    else if (t.includes('sent')) event = 'sent';

    // Try to resolve user_id from profiles
    const { data: profile } = await supabase.from('profiles').select('user_id').eq('email', email).maybeSingle();

    await supabase.from('email_events').insert({
      user_id: profile?.user_id ?? null,
      email,
      type: data?.tags?.find?.((x: any) => x?.name === 'campaign')?.value ?? 'welcome',
      provider_message_id: providerId,
      event,
      metadata: data ?? {},
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('resend-webhooks error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});