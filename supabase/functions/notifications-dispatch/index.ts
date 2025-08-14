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
  category?: "blogs" | "exams" | "bookings" | "forums";
};

type Payload = {
  toUserIds?: string[];
  toEmails?: string[];
  toRole?: "admin" | "guru" | "user";
  subject: string;
  html: string;
  inApp?: InAppItem[];
  category?: "blogs" | "exams" | "bookings" | "forums";
  sms?: {
    toUserIds?: string[];
    toPhones?: string[];
    message: string;
  };
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SMS_API_KEY = Deno.env.get("SMS_API_KEY") || "";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function resolveEmailsFromUserIds(userIds: string[], category?: string): Promise<string[]> {
  if (!userIds?.length) return [];
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, user_id, notification_settings")
    .in("user_id", userIds);
  if (error) {
    console.warn("resolveEmailsFromUserIds error", error);
    return [];
  }
  const emails: string[] = [];
  for (const r of (data as any[]) || []) {
    const email = (r?.email || "").trim();
    if (!email) continue;
    const prefs = (r?.notification_settings as any) || {};
    
    // Check channel preference (default: enabled)
    const emailEnabled = prefs?.channels?.email !== false;
    if (!emailEnabled) continue;
    
    // Check category preference if specified (default: enabled)
    if (category) {
      const categoryEnabled = prefs?.categories?.[category] !== false;
      if (!categoryEnabled) continue;
    }
    
    emails.push(email);
  }
  return emails;
}

async function resolvePhonesFromUserIds(userIds: string[], category?: string): Promise<string[]> {
  if (!userIds?.length || !SMS_API_KEY) return [];
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("phone, user_id, notification_settings")
    .in("user_id", userIds);
  if (error) {
    console.warn("resolvePhonesFromUserIds error", error);
    return [];
  }
  const phones: string[] = [];
  for (const r of (data as any[]) || []) {
    const phone = (r?.phone || "").trim();
    if (!phone) continue;
    const prefs = (r?.notification_settings as any) || {};
    
    // Check channel preference (default: disabled for SMS)
    const smsEnabled = prefs?.channels?.sms === true;
    if (!smsEnabled) continue;
    
    // Check category preference if specified (default: enabled)
    if (category) {
      const categoryEnabled = prefs?.categories?.[category] !== false;
      if (!categoryEnabled) continue;
    }
    
    phones.push(phone);
  }
  return phones;
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

async function insertInApp(items: InAppItem[], category?: string) {
  if (!items?.length) return;
  const rows: any[] = [];
  for (const it of items) {
    if (it.toRole) {
      const ids = await resolveUserIdsByRole(it.toRole);
      // Filter by user preferences for in-app notifications
      const filteredIds = await filterUsersByPreferences(ids, "inapp", category);
      filteredIds.forEach((uid) =>
        rows.push({ 
          user_id: uid, 
          type: it.type, 
          title: it.title, 
          body: it.body ?? null, 
          data: { ...it.data, category: it.category || category }
        })
      );
    } else if (it.userId) {
      const filteredIds = await filterUsersByPreferences([it.userId], "inapp", category);
      if (filteredIds.length > 0) {
        rows.push({ 
          user_id: it.userId, 
          type: it.type, 
          title: it.title, 
          body: it.body ?? null, 
          data: { ...it.data, category: it.category || category }
        });
      }
    }
  }
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) console.warn("insertInApp error", error);
}

async function filterUsersByPreferences(userIds: string[], channel: "email" | "sms" | "inapp", category?: string): Promise<string[]> {
  if (!userIds?.length) return [];
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, notification_settings")
    .in("user_id", userIds);
  if (error) {
    console.warn("filterUsersByPreferences error", error);
    return userIds; // fallback to all users on error
  }
  
  const filtered: string[] = [];
  for (const r of (data as any[]) || []) {
    const prefs = (r?.notification_settings as any) || {};
    
    // Check channel preference
    let channelEnabled = true;
    if (channel === "email") {
      channelEnabled = prefs?.channels?.email !== false; // default: enabled
    } else if (channel === "sms") {
      channelEnabled = prefs?.channels?.sms === true; // default: disabled
    } else if (channel === "inapp") {
      channelEnabled = prefs?.channels?.inapp !== false; // default: enabled
    }
    
    if (!channelEnabled) continue;
    
    // Check category preference if specified
    if (category) {
      const categoryEnabled = prefs?.categories?.[category] !== false; // default: enabled
      if (!categoryEnabled) continue;
    }
    
    filtered.push(r.user_id);
  }
  return filtered;
}

async function sendEmailIfConfigured(toEmails: string[], subject: string, html: string) {
  if (!toEmails?.length) return;
  const footer = `<hr/><p style="font-size:12px;color:#666">Manage your notifications: <a href="/settings/notifications">/settings/notifications</a></p>`;
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

async function sendSmsIfConfigured(toPhones: string[], message: string) {
  if (!toPhones?.length || !SMS_API_KEY) {
    if (toPhones?.length && !SMS_API_KEY) {
      console.log("SMS requested but no provider configured; skipping", { count: toPhones.length });
    }
    return;
  }
  
  try {
    // SMS provider implementation would go here
    // For now, just log that we would send SMS
    console.log("SMS would be sent to", toPhones.length, "recipients:", message);
    
    // Example implementation for a hypothetical SMS provider:
    // const response = await fetch('https://api.sms-provider.com/send', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${SMS_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to: toPhones, message })
    // });
    
  } catch (e) {
    console.error("notifications-dispatch: SMS send error", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    const inAppItems: InAppItem[] = body.inApp || [];
    const category = body.category;

    // In-app insertions
    await insertInApp(inAppItems, category);

    // Build email recipients
    const directEmails = (body.toEmails || []).filter(Boolean);
    let userIds: string[] = body.toUserIds || [];
    if (body.toRole) {
      const roleIds = await resolveUserIdsByRole(body.toRole);
      userIds = [...new Set([...userIds, ...roleIds])];
    }
    const userEmails = await resolveEmailsFromUserIds(userIds, category);
    const recipients = Array.from(new Set([...directEmails, ...userEmails]));

    await sendEmailIfConfigured(recipients, body.subject, body.html);

    // Handle SMS if requested
    let smsCount = 0;
    if (body.sms) {
      const directPhones = (body.sms.toPhones || []).filter(Boolean);
      let smsUserIds: string[] = body.sms.toUserIds || [];
      if (body.toRole) {
        const roleIds = await resolveUserIdsByRole(body.toRole);
        smsUserIds = [...new Set([...smsUserIds, ...roleIds])];
      }
      const userPhones = await resolvePhonesFromUserIds(smsUserIds, category);
      const smsRecipients = Array.from(new Set([...directPhones, ...userPhones]));
      smsCount = smsRecipients.length;
      
      await sendSmsIfConfigured(smsRecipients, body.sms.message);
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      recipients: recipients.length,
      smsRecipients: smsCount,
      category 
    }), {
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
