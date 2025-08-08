import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATIONS_EMAIL") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function supaFor(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") || undefined;
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false },
  });
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!resend) { console.warn("Resend not configured, skipping email", { to, subject }); return; }
  await resend.emails.send({ from: "EMGurus <onboarding@resend.dev>", to, subject, html });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const supabase = supaFor(req);

    // POST /notify - body: { type: 'submitted' | 'approved' | 'rejected', user_id }
    if (path.endsWith("/notify") && req.method === "POST") {
      const { type, user_id } = await req.json();
      if (!type || !user_id) return new Response(JSON.stringify({ error: 'type and user_id required' }), { status: 400, headers: corsHeaders });

      const { data: prof } = await supabase.from('profiles').select('email, full_name').eq('user_id', user_id).maybeSingle();
      const userEmail = prof?.email;
      const userName = prof?.full_name || 'User';

      if (type === 'submitted') {
        if (ADMIN_EMAIL) await sendEmail([ADMIN_EMAIL], 'New Guru Application Submitted', `<p>${userName} (${userEmail || user_id}) submitted a new Guru application.</p>`);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (!userEmail) return new Response(JSON.stringify({ error: 'User email missing' }), { status: 400, headers: corsHeaders });

      if (type === 'approved') {
        await sendEmail([userEmail], 'Your Guru Application is Approved', `<p>Congratulations ${userName}! Your Guru application has been approved. You now have access to Guru features.</p>`);
      } else if (type === 'rejected') {
        await sendEmail([userEmail], 'Your Guru Application', `<p>Hi ${userName}, unfortunately your Guru application was not approved at this time.</p>`);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
