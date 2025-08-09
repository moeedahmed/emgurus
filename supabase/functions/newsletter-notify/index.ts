import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { email, source_page }: { email?: string; source_page?: string } = await req.json().catch(() => ({} as any));
    if (!email) return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h3 style="margin:0 0 12px">New newsletter subscriber</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Source:</strong> ${source_page || 'unknown'}</p>
      </div>
    `;

    const sendRes = await resend.emails.send({
      from: 'EM Gurus <emgurus@gmail.com>',
      to: ['emgurus@gmail.com'],
      subject: 'New newsletter subscriber',
      html,
      tags: [{ name: 'campaign', value: 'newsletter_subscribe' }],
    });

    return new Response(JSON.stringify({ ok: true, id: (sendRes as any)?.data?.id || null }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('newsletter-notify error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});