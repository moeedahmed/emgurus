import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

type InAppItem = {
  userId?: string;
  toRole?: "admin" | "guru" | "user";
  type: string;
  title: string;
  body?: string;
  data?: any;
};

type Payload = {
  toUserIds?: string[];
  toEmails?: string[];
  toRole?: "admin" | "guru" | "user";
  subject: string;
  html: string;
  inApp?: InAppItem[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function resolveEmailsFromUserIds(userIds: string[]): Promise<string[]> {
  if (!userIds?.length) return [];
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, user_id")
    .in("user_id", userIds);
  if (error) {
    console.warn("resolveEmailsFromUserIds error", error);
    return [];
  }
  return (data || [])
    .map((r: any) => (r?.email || "").trim())
    .filter((e) => !!e);
}

async function resolveUserIdsByRole(role: "admin" | "guru" | "user"): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", role);
  if (error) {
    console.warn("resolveUserIdsByRole error", error);
    return [];
  }
  return (data || []).map((r: any) => r.user_id);
}

async function insertInApp(items: InAppItem[]) {
  if (!items?.length) return;
  const rows: any[] = [];
  for (const it of items) {
    if (it.toRole) {
      const ids = await resolveUserIdsByRole(it.toRole);
      ids.forEach((uid) =>
        rows.push({ user_id: uid, type: it.type, title: it.title, body: it.body ?? null, data: it.data ?? null })
      );
    } else if (it.userId) {
      rows.push({ user_id: it.userId, type: it.type, title: it.title, body: it.body ?? null, data: it.data ?? null });
    }
  }
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) console.warn("insertInApp error", error);
}

async function sendEmailIfConfigured(toEmails: string[], subject: string, html: string) {
  if (!toEmails?.length) return;
  const footer = `<hr/><p style="font-size:12px;color:#666">Manage your notifications: <a href="${SUPABASE_URL?.replace(":8080", "")?.replace("https://", "https://")}/settings/notifications">/settings/notifications</a></p>`;
  const mergedHtml = `${html}${footer}`;
  if (!resend) {
    console.warn("Resend not configured; skipping email", { subject, toEmails });
    return;
  }
  try {
    const res = await resend.emails.send({ from: "EMGurus <onboarding@resend.dev>", to: toEmails, subject, html: mergedHtml });
    console.log("notifications-dispatch: email sent", res?.id || res);
  } catch (e) {
    console.error("notifications-dispatch: email send error", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    const inAppItems: InAppItem[] = body.inApp || [];

    // In-app insertions
    await insertInApp(inAppItems);

    // Build email recipients
    const directEmails = (body.toEmails || []).filter(Boolean);
    let userIds: string[] = body.toUserIds || [];
    if (body.toRole) {
      const roleIds = await resolveUserIdsByRole(body.toRole);
      userIds = [...new Set([...userIds, ...roleIds])];
    }
    const userEmails = await resolveEmailsFromUserIds(userIds);
    const recipients = Array.from(new Set([...directEmails, ...userEmails]));

    await sendEmailIfConfigured(recipients, body.subject, body.html);

    return new Response(JSON.stringify({ ok: true, recipients: recipients.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("notifications-dispatch error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
