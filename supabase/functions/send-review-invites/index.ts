import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Find users created >= 5 days ago without invite
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, created_at')
      .lte('created_at', fiveDaysAgo);
    if (error) throw error;

    const due = profiles?.filter(Boolean) || [];

    let sentCount = 0;

    for (const p of due) {
      if (!p?.email || !p?.user_id) continue;

      // Idempotency check
      const { data: existing } = await supabase
        .from('review_invitations')
        .select('id')
        .eq('user_id', p.user_id)
        .eq('source', 'post_onboarding_5d')
        .maybeSingle();
      if (existing) continue;

      const fname = (p.full_name?.trim()?.split(/\s+/)[0]) || p.email.split('@')[0];
      const html = `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2 style="margin:0 0 12px">How's EM Gurus so far?</h2>
          <p>Hi ${fname},</p>
          <p>We hope you're finding EM Gurus helpful. We'd really appreciate a quick review on Trustpilot – it helps us support more clinicians.</p>
          <p><a href="https://uk.trustpilot.com/review/emgurus.com" target="_blank" style="color:#2563eb;text-decoration:underline">Leave a review on Trustpilot</a></p>
          <p>Thank you! – The EM Gurus Team</p>
        </div>
      `;

      const sendRes = await resend.emails.send({
        from: 'EM Gurus <emgurus@gmail.com>',
        to: [p.email],
        subject: 'Quick favour? Share your EM Gurus experience',
        html,
        tags: [{ name: 'campaign', value: 'review_invite' }],
      });

      const providerId = (sendRes as any)?.data?.id ?? null;

      await supabase.from('review_invitations').insert({
        user_id: p.user_id,
        email: p.email,
        source: 'post_onboarding_5d',
        status: 'sent',
        trustpilot_invite_id: providerId,
      });

      await supabase.from('email_events').insert({
        user_id: p.user_id,
        email: p.email,
        type: 'review_invite',
        event: 'sent',
        provider_message_id: providerId,
        metadata: {},
      });

      sentCount++;
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('send-review-invites error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});