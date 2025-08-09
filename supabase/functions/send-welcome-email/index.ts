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

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface BodyIn { user_id?: string; email?: string; full_name?: string }

function firstNameOf(name?: string | null): string {
  if (!name) return "there";
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id: bodyUserId, email: bodyEmail, full_name: bodyFullName }: BodyIn = await req.json().catch(() => ({}) as any);

    // Determine user
    let userId = bodyUserId;
    let email = bodyEmail;
    let fullName = bodyFullName;

    if (!userId || !email || !fullName) {
      // Try to resolve from DB
      if (userId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('user_id, email, full_name')
          .eq('user_id', userId)
          .maybeSingle();
        email = email || profile?.email || undefined;
        fullName = fullName || profile?.full_name || undefined;
      }
    }

    if (!userId) {
      // Last resort: try to match by email
      if (email) {
        const { data: profileByEmail } = await supabaseAdmin
          .from('profiles')
          .select('user_id, email, full_name')
          .eq('email', email)
          .maybeSingle();
        userId = profileByEmail?.user_id ?? undefined;
        fullName = fullName || profileByEmail?.full_name || undefined;
      }
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Idempotency: skip if already sent
    const { data: existing } = await supabaseAdmin
      .from('email_events')
      .select('id')
      .eq('email', email)
      .eq('type', 'welcome')
      .eq('event', 'sent')
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const fname = firstNameOf(fullName ?? email.split('@')[0]);

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to EM Gurus – Let’s Get Started!</h2>
        <p>Hi ${fname},</p>
        <p>Welcome to EM Gurus – your trusted hub for Emergency Medicine career guidance, blogs, exams, and mentorship. Explore our content, start practising questions, and connect with top Gurus worldwide.</p>
        <p>If you have any questions, reply to this email – we’re here to help.</p>
        <p>– The EM Gurus Team</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="font-size:12px;color:#64748b">You received this because you signed up at EM Gurus.</p>
      </div>
    `;

    const sendRes = await resend.emails.send({
      from: 'EM Gurus <emgurus@gmail.com>',
      to: [email],
      subject: 'Welcome to EM Gurus – Let’s Get Started!',
      html,
      tags: [{ name: 'campaign', value: 'welcome' }],
    });

    const providerId = (sendRes as any)?.data?.id ?? null;

    await supabaseAdmin.from('email_events').insert({
      user_id: userId ?? null,
      email,
      type: 'welcome',
      event: 'sent',
      provider_message_id: providerId,
      metadata: {},
    });

    return new Response(JSON.stringify({ ok: true, id: providerId }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('send-welcome-email error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});