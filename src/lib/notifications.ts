import { supabase } from "@/integrations/supabase/client";

export type InAppNotice = {
  toUserId: string;
  type: string; // custom kind, stored in data.kind; DB type uses 'message'
  title: string;
  body?: string;
  data?: any;
};

export type NotificationCategory = "blogs" | "exams" | "bookings" | "forums";

export type UnifiedNotification = {
  toUserIds?: string[];
  toEmails?: string[];
  toRole?: "admin" | "guru" | "user";
  category: NotificationCategory;
  subject: string;
  html: string;
  inApp?: {
    type: string;
    title: string;
    body?: string;
    data?: any;
  };
  sms?: {
    toUserIds?: string[];
    toPhones?: string[];
    message: string;
  };
};

export async function notify(notification: UnifiedNotification) {
  try {
    const payload: any = {
      toUserIds: notification.toUserIds,
      toEmails: notification.toEmails,
      toRole: notification.toRole,
      category: notification.category,
      subject: notification.subject,
      html: notification.html,
      sms: notification.sms,
    };

    if (notification.inApp) {
      payload.inApp = [{
        toRole: notification.toRole,
        type: notification.inApp.type,
        title: notification.inApp.title,
        body: notification.inApp.body,
        data: notification.inApp.data,
        category: notification.category,
      }];
      
      // If specific user IDs are provided, create individual in-app notifications
      if (notification.toUserIds) {
        notification.toUserIds.forEach(userId => {
          payload.inApp.push({
            userId,
            type: notification.inApp!.type,
            title: notification.inApp!.title,
            body: notification.inApp!.body,
            data: notification.inApp!.data,
            category: notification.category,
          });
        });
      }
    }

    await supabase.functions.invoke("notifications-dispatch", { body: payload });
  } catch (e) {
    console.warn("notify failed", e);
  }
}

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
  category?: NotificationCategory;
  inApp?: { type: string; title: string; body?: string; data?: any };
}) {
  await notify({
    toRole: "admin",
    category: args.category || "forums", // default fallback
    subject: args.subject,
    html: args.html,
    inApp: args.inApp,
  });
}

// Specific notification helpers for each workflow
export async function notifyBlogWorkflow(args: {
  action: "assigned" | "approved" | "rejected" | "published";
  toUserIds?: string[];
  toRole?: "admin" | "guru" | "user";
  postTitle: string;
  reviewerName?: string;
  note?: string;
}) {
  const actionTexts = {
    assigned: { subject: "Blog review assigned", title: "Blog assigned for review" },
    approved: { subject: "Blog approved", title: "Your blog was approved" },
    rejected: { subject: "Blog needs changes", title: "Your blog needs changes" },
    published: { subject: "Blog published", title: "Your blog was published" },
  };
  
  const { subject, title } = actionTexts[args.action];
  
  await notify({
    toUserIds: args.toUserIds,
    toRole: args.toRole,
    category: "blogs",
    subject: `${subject}: ${args.postTitle}`,
    html: `<h2>${title}</h2><p>Post: <strong>${args.postTitle}</strong></p>${args.note ? `<p>Note: ${args.note}</p>` : ''}${args.reviewerName ? `<p>Reviewer: ${args.reviewerName}</p>` : ''}`,
    inApp: {
      type: `blog_${args.action}`,
      title,
      body: args.postTitle,
      data: { postTitle: args.postTitle, action: args.action, note: args.note },
    },
  });
}

export async function notifyExamWorkflow(args: {
  action: "assigned" | "approved" | "rejected" | "flagged" | "flag_resolved";
  toUserIds?: string[];
  toRole?: "admin" | "guru" | "user";
  questionId: string;
  questionStem?: string;
  reviewerName?: string;
  note?: string;
}) {
  const actionTexts = {
    assigned: { subject: "Question review assigned", title: "Question assigned for review" },
    approved: { subject: "Question approved", title: "Your question was approved" },
    rejected: { subject: "Question needs changes", title: "Your question needs changes" },
    flagged: { subject: "Question flagged", title: "Question flagged for review" },
    flag_resolved: { subject: "Flag resolved", title: "Your flagged question was processed" },
  };
  
  const { subject, title } = actionTexts[args.action];
  const questionText = args.questionStem ? args.questionStem.slice(0, 100) + "..." : args.questionId;
  
  await notify({
    toUserIds: args.toUserIds,
    toRole: args.toRole,
    category: "exams",
    subject: `${subject}: ${questionText}`,
    html: `<h2>${title}</h2><p>Question: <strong>${questionText}</strong></p>${args.note ? `<p>Note: ${args.note}</p>` : ''}${args.reviewerName ? `<p>Reviewer: ${args.reviewerName}</p>` : ''}`,
    inApp: {
      type: `exam_${args.action}`,
      title,
      body: questionText,
      data: { questionId: args.questionId, action: args.action, note: args.note },
    },
  });
}

export async function notifyBookingWorkflow(args: {
  action: "created" | "confirmed" | "cancelled" | "rescheduled";
  toUserIds?: string[];
  guruName: string;
  studentName: string;
  dateTime: string;
  note?: string;
}) {
  const actionTexts = {
    created: { subject: "New booking request", title: "New consultation booked" },
    confirmed: { subject: "Booking confirmed", title: "Your consultation was confirmed" },
    cancelled: { subject: "Booking cancelled", title: "Consultation cancelled" },
    rescheduled: { subject: "Booking rescheduled", title: "Consultation rescheduled" },
  };
  
  const { subject, title } = actionTexts[args.action];
  
  await notify({
    toUserIds: args.toUserIds,
    category: "bookings",
    subject: `${subject} with ${args.guruName}`,
    html: `<h2>${title}</h2><p>Guru: <strong>${args.guruName}</strong></p><p>Student: <strong>${args.studentName}</strong></p><p>Date: <strong>${args.dateTime}</strong></p>${args.note ? `<p>Note: ${args.note}</p>` : ''}`,
    inApp: {
      type: `booking_${args.action}`,
      title,
      body: `${args.guruName} - ${args.dateTime}`,
      data: { guruName: args.guruName, studentName: args.studentName, dateTime: args.dateTime, action: args.action, note: args.note },
    },
  });
}

export async function notifyForumWorkflow(args: {
  action: "flagged" | "flag_assigned" | "flag_resolved" | "flag_dismissed";
  toUserIds?: string[];
  toRole?: "admin" | "guru" | "user";
  threadTitle?: string;
  moderatorName?: string;
  note?: string;
}) {
  const actionTexts = {
    flagged: { subject: "Content flagged", title: "Content flagged for review" },
    flag_assigned: { subject: "Flag assigned", title: "Flag assigned for review" },
    flag_resolved: { subject: "Flag resolved", title: "Flag resolved" },
    flag_dismissed: { subject: "Flag dismissed", title: "Flag dismissed" },
  };
  
  const { subject, title } = actionTexts[args.action];
  const contentText = args.threadTitle || "Forum content";
  
  await notify({
    toUserIds: args.toUserIds,
    toRole: args.toRole,
    category: "forums",
    subject: `${subject}: ${contentText}`,
    html: `<h2>${title}</h2><p>Content: <strong>${contentText}</strong></p>${args.note ? `<p>Note: ${args.note}</p>` : ''}${args.moderatorName ? `<p>Moderator: ${args.moderatorName}</p>` : ''}`,
    inApp: {
      type: `forum_${args.action}`,
      title,
      body: contentText,
      data: { threadTitle: args.threadTitle, action: args.action, note: args.note },
    },
  });
}
