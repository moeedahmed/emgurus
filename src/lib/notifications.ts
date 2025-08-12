import { supabase } from "@/integrations/supabase/client";

export type InAppNotice = {
  toUserId: string;
  type: string; // custom kind, stored in data.kind; DB type uses 'message'
  title: string;
  body?: string;
  data?: any;
};

export async function notifyInApp(n: InAppNotice) {
  try {
    const baseData = n.data ?? {};
    await supabase.from("notifications").insert({
      user_id: n.toUserId as any,
      type: "message" as any,
      title: n.title,
      body: n.body ?? null,
      data: { ...baseData, kind: n.type },
    } as any);
  } catch (e) {
    console.warn("notifyInApp failed", e);
  }
}

export async function notifyEmailIfConfigured(args: {
  toUserIds?: string[];
  toEmails?: string[];
  subject: string;
  html: string;
}) {
  try {
    await supabase.functions.invoke("notifications-dispatch", {
      body: {
        toUserIds: args.toUserIds || [],
        toEmails: args.toEmails || [],
        subject: args.subject,
        html: args.html,
      },
    });
  } catch (e) {
    // Intentionally swallow: if not configured, edge will log "needs provider"
    console.warn("notifyEmailIfConfigured failed or skipped", e);
  }
}

export async function notifyAdmins(args: {
  subject: string;
  html: string;
  inApp?: { type: string; title: string; body?: string; data?: any };
}) {
  try {
    await supabase.functions.invoke("notifications-dispatch", {
      body: {
        toRole: "admin",
        subject: args.subject,
        html: args.html,
        inApp: args.inApp
          ? [
              {
                toRole: "admin",
                type: args.inApp.type,
                title: args.inApp.title,
                body: args.inApp.body,
                data: args.inApp.data ?? null,
              },
            ]
          : [],
      },
    });
  } catch (e) {
    console.warn("notifyAdmins failed or skipped", e);
  }
}
