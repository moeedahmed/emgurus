// Consultations API - Supabase Edge Function
// Provides REST endpoints per the EMGurus contract via a single function router.
// Auth: Public for read-only guru discovery; JWT required for bookings, payments, guru/admin actions.
// Docs: Swagger UI at /api/docs and OpenAPI JSON at /api/openapi.json

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fromZonedTime } from "https://esm.sh/date-fns-tz@3.0.0";
import { Resend } from "npm:resend@4.0.0";
import { requireEntitlement } from "../_shared/entitlements.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function unauthorized(msg = "Unauthorized") { return json({ error: msg }, 401); }
function badRequest(msg = "Bad Request") { return json({ error: msg }, 400); }
function notFound(msg = "Not Found") { return json({ error: msg }, 404); }
function forbidden(msg = "Requires active subscription") { return json({ error: msg }, 403); }
function serverError(msg: string, details?: unknown) {
  console.error("Server error:", msg, details);
  return json({ error: msg }, 500);
}

function getBearer(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.replace("Bearer ", "");
}

function supaFor(req: Request) {
  const token = getBearer(req);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthUser(req: Request) {
  const token = getBearer(req);
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

async function hasRole(req: Request, role: "admin" | "guru") {
  const user = await getAuthUser(req);
  if (!user) return false;
  const supabase = supaFor(req);
  const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: role });
  if (error) {
    console.error("has_role error", error);
    return false;
  }
  return !!data;
}

// OpenAPI spec (minimal, extend as needed)
const openApi = {
  openapi: "3.0.3",
  info: {
    title: "EMGurus Consultations API",
    version: "1.0.0",
    description: "Consultations backend exposing gurus, availability, bookings, and payments.",
  },
  servers: [{ url: "/functions/v1/consultations-api" }],
  paths: {
    "/api/gurus": {
      get: {
        summary: "List gurus",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "country", in: "query", schema: { type: "string" } },
          { name: "exam", in: "query", schema: { type: "string" } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          { name: "sort", in: "query", schema: { type: "string" }, description: "price_asc|price_desc|name" },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/gurus/{id}": {
      get: {
        summary: "Get guru by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },
    "/api/gurus/{id}/availability": {
      get: {
        summary: "Guru availability between dates (UTC)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/bookings": {
      post: {
        summary: "Create booking (pending payment)",
        requestBody: { required: true },
        responses: { 200: { description: "OK" }, 401: { description: "Unauthorized" } },
      },
    },
    "/api/payments": {
      post: {
        summary: "Create Stripe Checkout session for a booking",
        requestBody: { required: true },
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/payments/verify": {
      post: {
        summary: "Verify Stripe session and confirm booking",
        requestBody: { required: true },
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/guru/bookings": { get: { summary: "Guru bookings (auth:guru)", responses: { 200: { description: "OK" } } } },
  },
};

function swaggerHtml(specUrl: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>EMGurus API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  window.ui = SwaggerUIBundle({
    url: '${specUrl}',
    dom_id: '#swagger'
  });
</script>
</body>
</html>`;
}

function daysBetween(start: Date, end: Date) {
  const result: string[] = [];
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (d <= last) {
    result.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}

// Email + formatting helpers
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATIONS_EMAIL") || "";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function usd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}
function formatInTz(iso: string, tz?: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: tz || 'UTC' }).format(new Date(iso));
  } catch {
    return iso;
  }
}
function getServiceClient() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
async function sendEmail(to: string[], subject: string, html: string, bcc?: string[]) {
  if (!resend) {
    console.warn("Resend API key not configured; skipping email:", { subject, to });
    return;
  }
  try {
    await resend.emails.send({ from: "EMGurus <onboarding@resend.dev>", to, bcc, subject, html });
  } catch (e) {
    console.error("Resend send error", e);
  }
}

async function sendBookingEmails(bookingId: string) {
  const supabase = getServiceClient();
  const { data: booking, error: bErr } = await supabase
    .from("consult_bookings")
    .select("id, user_id, guru_id, start_datetime, end_datetime, meeting_link, price, payment_status, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking) {
    console.error("sendBookingEmails: booking fetch error", bErr);
    return;
  }
  const { data: userProf } = await supabase
    .from("profiles")
    .select("email, full_name, timezone")
    .eq("user_id", booking.user_id)
    .maybeSingle();
  const { data: guruProf } = await supabase
    .from("profiles")
    .select("email, full_name, specialty, timezone")
    .eq("user_id", booking.guru_id)
    .maybeSingle();

  const userEmail = userProf?.email;
  const userName = userProf?.full_name || "Student";
  const userTz = userProf?.timezone || "UTC";
  const guruEmail = guruProf?.email;
  const guruName = guruProf?.full_name || "Guru";
  const guruTz = guruProf?.timezone || "UTC";
  const specialty = (guruProf as any)?.specialty || "";

  const whenForUser = formatInTz(booking.start_datetime, userTz);
  const whenForGuru = formatInTz(booking.start_datetime, guruTz);
  const link = booking.meeting_link || "To be shared before the session";
  const bookingType = Number(booking.price || 0) > 0
    ? `Paid: ${usd(Number(booking.price))} via Stripe`
    : "Free booking";

  const userSubject = `Your consultation with ${guruName} is confirmed`;
  const userHtml = `
    <h2>Booking Confirmed</h2>
    <p>Hi ${userName},</p>
    <p>Your consultation with <strong>${guruName}</strong>${specialty ? ` (${specialty})` : ""} is confirmed.</p>
    <p><strong>Date & Time:</strong> ${whenForUser} (${userTz})</p>
    <p><strong>Meeting link:</strong> <a href="${link}">${link}</a></p>
    <p><strong>Booking type:</strong> ${bookingType}</p>
    ${Number(booking.price || 0) > 0 ? "<p>This email serves as your receipt.</p>" : ""}
    <p>See you then!</p>
  `;

  const guruSubject = `New booking from ${userName}`;
  const guruHtml = `
    <h2>New Booking</h2>
    <p>You have a new consultation.</p>
    <p><strong>Student:</strong> ${userName}${userEmail ? ` (${userEmail})` : ""}</p>
    <p><strong>Date & Time:</strong> ${whenForGuru} (${guruTz})</p>
    <p><strong>Meeting link:</strong> <a href="${link}">${link}</a></p>
  `;

  if (userEmail) await sendEmail([userEmail], userSubject, userHtml, ADMIN_EMAIL ? [ADMIN_EMAIL] : undefined);
  if (guruEmail) await sendEmail([guruEmail], guruSubject, guruHtml);
  if (ADMIN_EMAIL) {
    const adminHtml = `
      <h2>Booking Copy</h2>
      <p>Booking ID: ${booking.id}</p>
      <p>Guru: ${guruName} (${specialty}) - ${guruEmail || "no email"}</p>
      <p>User: ${userName} - ${userEmail || "no email"}</p>
      <p>Start: ${booking.start_datetime}</p>
      <p>Price: ${usd(Number(booking.price || 0))} (${bookingType})</p>
      <p>Status: ${booking.status} / ${booking.payment_status}</p>
      <p>Link: ${link}</p>
    `;
    await sendEmail([ADMIN_EMAIL], `Copy: Booking ${booking.id} confirmed`, adminHtml);
  }
}

async function sendReminderEmails(bookingId: string) {
  const supabase = getServiceClient();
  const { data: booking } = await supabase
    .from("consult_bookings")
    .select("id, user_id, guru_id, start_datetime, meeting_link, price")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;

  const { data: userProf } = await supabase.from("profiles").select("email, full_name, timezone").eq("user_id", booking.user_id).maybeSingle();
  const { data: guruProf } = await supabase.from("profiles").select("email, full_name, timezone").eq("user_id", booking.guru_id).maybeSingle();

  const userEmail = userProf?.email;
  const userName = userProf?.full_name || "Student";
  const userTz = userProf?.timezone || "UTC";
  const guruEmail = guruProf?.email;
  const guruName = guruProf?.full_name || "Guru";
  const guruTz = guruProf?.timezone || "UTC";
  const whenForUser = formatInTz(booking.start_datetime, userTz);
  const whenForGuru = formatInTz(booking.start_datetime, guruTz);
  const link = booking.meeting_link || "To be shared before the session";

  const subject = "Reminder: Your consultation is in 1 hour";
  const userHtml = `
    <h2>Reminder</h2>
    <p>Hi ${userName}, this is a reminder for your consultation in 1 hour.</p>
    <p><strong>Date & Time:</strong> ${whenForUser} (${userTz})</p>
    <p><strong>Meeting link:</strong> <a href="${link}">${link}</a></p>
  `;
  const guruHtml = `
    <h2>Reminder</h2>
    <p>Hi ${guruName}, you have a consultation in 1 hour.</p>
    <p><strong>Date & Time:</strong> ${whenForGuru} (${guruTz})</p>
    <p><strong>Meeting link:</strong> <a href="${link}">${link}</a></p>
  `;

  if (userEmail) await sendEmail([userEmail], subject, userHtml);
  if (guruEmail) await sendEmail([guruEmail], subject, guruHtml);
}

async function sendCancellationEmails(bookingId: string, wasPaid: boolean) {
  const supabase = getServiceClient();
  const { data: booking } = await supabase
    .from("consult_bookings")
    .select("id, user_id, guru_id, start_datetime, meeting_link, price")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;

  const { data: userProf } = await supabase.from("profiles").select("email, full_name, timezone").eq("user_id", booking.user_id).maybeSingle();
  const { data: guruProf } = await supabase.from("profiles").select("email, full_name, specialty, timezone").eq("user_id", booking.guru_id).maybeSingle();

  const userEmail = userProf?.email;
  const userName = userProf?.full_name || "Student";
  const userTz = userProf?.timezone || "UTC";
  const guruEmail = guruProf?.email;
  const guruName = guruProf?.full_name || "Guru";
  const guruTz = guruProf?.timezone || "UTC";
  const specialty = (guruProf as any)?.specialty || "";

  const whenForUser = formatInTz(booking.start_datetime, userTz);
  const whenForGuru = formatInTz(booking.start_datetime, guruTz);
  const link = booking.meeting_link || `https://meet.jit.si/${bookingId}`;

  const refundText = wasPaid ? " A refund is being processed via Stripe." : "";

  const userSubject = `Consultation with ${guruName} has been cancelled`;
  const userHtml = `
    <h2>Cancellation Confirmed</h2>
    <p>Hi ${userName}, your consultation with <strong>${guruName}</strong>${specialty ? ` (${specialty})` : ""} has been cancelled.</p>
    <p><strong>Original Date & Time:</strong> ${whenForUser} (${userTz})</p>
    <p>The slot has been reopened.${refundText}</p>
  `;

  const guruSubject = `Booking cancelled by ${userName}`;
  const guruHtml = `
    <h2>Booking Cancelled</h2>
    <p>The consultation was cancelled by the student.</p>
    <p><strong>Student:</strong> ${userName}${userEmail ? ` (${userEmail})` : ""}</p>
    <p><strong>Original Date & Time:</strong> ${whenForGuru} (${guruTz})</p>
    <p>The slot has been reopened.${refundText}</p>
  `;

  if (userEmail) await sendEmail([userEmail], userSubject, userHtml, ADMIN_EMAIL ? [ADMIN_EMAIL] : undefined);
  if (guruEmail) await sendEmail([guruEmail], guruSubject, guruHtml);
  if (ADMIN_EMAIL) {
    await sendEmail([ADMIN_EMAIL], `Copy: Booking ${bookingId} cancelled`, `<p>Booking ${bookingId} was cancelled. Paid: ${wasPaid ? "yes" : "no"}.</p>`);
  }
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const supabase = supaFor(req);

    // Docs
    if (path.endsWith("/api/openapi.json")) {
      return new Response(JSON.stringify(openApi), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (path.endsWith("/api/docs")) {
      const specUrl = url.origin + url.pathname.replace(/\/api\/docs$/, "/api/openapi.json");
      return new Response(swaggerHtml(specUrl), { headers: { "Content-Type": "text/html", ...corsHeaders } });
    }

    // GET /api/gurus
    if (path.endsWith("/api/gurus") && req.method === "GET") {
      const search = url.searchParams.get("search")?.trim();
      const country = url.searchParams.get("country")?.trim();
      const exam = url.searchParams.get("exam")?.trim();
      const minPrice = url.searchParams.get("minPrice");
      const maxPrice = url.searchParams.get("maxPrice");
      const sort = url.searchParams.get("sort") || "";
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = 12;

      let query = supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, specialty, country, exams, price_per_30min, timezone, bio", { count: "exact" })
        .neq("user_id", "080c2b2d-2b51-4484-9027-a037216c3a7c");
      // RLS exposes only guru profiles via existing policy

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,specialty.ilike.%${search}%`);
      }
      if (country && country !== "all") query = query.eq("country", country);
      if (exam && exam !== "all") query = query.contains("exams", [exam]);
      if (minPrice) query = query.gte("price_per_30min", Number(minPrice));
      if (maxPrice) query = query.lte("price_per_30min", Number(maxPrice));

      // Sorting
      if (sort === "price_asc") query = query.order("price_per_30min", { ascending: true });
      else if (sort === "price_desc") query = query.order("price_per_30min", { ascending: false });
      else if (sort === "name") query = query.order("full_name", { ascending: true });

      query = query.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await query;
      if (error) return serverError("Failed to list gurus", error);
      return json({ items: data, total: count, page, pageSize });
    }

    // GET /api/gurus/:id
    const guruIdMatch = path.match(/\/api\/gurus\/(.+)$/);
    if (guruIdMatch && req.method === "GET" && !path.endsWith("/availability")) {
      const guruId = guruIdMatch[1].split("/")[0];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, specialty, country, exams, price_per_30min, timezone, bio")
        .eq("user_id", guruId)
        .maybeSingle();
      if (error) return serverError("Failed to fetch guru", error);
      if (!data) return notFound("Guru not found");
      return json(data);
    }

    // GET /api/gurus/:id/availability?from&to
    const availMatch = path.match(/\/api\/gurus\/([^/]+)\/availability$/);
    if (availMatch && req.method === "GET") {
      const guruId = availMatch[1];
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const daysRange = url.searchParams.get("range");
      if (!from || !to) return badRequest("from and to (YYYY-MM-DD) are required");

      const fromDate = new Date(from + "T00:00:00Z");
      const toDate = new Date(to + "T00:00:00Z");

      // Guru timezone
      const { data: profTz, error: tzErr } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("user_id", guruId)
        .maybeSingle();
      if (tzErr) return serverError("Failed to load timezone", tzErr);
      const timezone = profTz?.timezone || "UTC";

      const { data: defaults, error: e1 } = await supabase
        .from("consult_availability")
        .select("id, type, day_of_week, start_time, end_time, is_available, date")
        .eq("guru_id", guruId)
        .eq("type", "default");
      if (e1) return serverError("Failed to fetch default availability", e1);

      const { data: exceptions, error: e2 } = await supabase
        .from("consult_availability")
        .select("id, type, day_of_week, start_time, end_time, is_available, date")
        .eq("guru_id", guruId)
        .eq("type", "exception")
        .gte("date", from)
        .lte("date", to);
      if (e2) return serverError("Failed to fetch exceptions", e2);

      // Build per-day windows using defaults + exceptions (simple merge)
      const days = daysBetween(fromDate, toDate);
      const byDate: Record<string, Array<any>> = {};
      for (const d of days) {
        byDate[d] = [];
        const dow = new Date(d + "T00:00:00Z").getUTCDay();
        const excForDay = (exceptions || []).filter((x) => x.date === d);
        if (excForDay.length > 0) {
          byDate[d] = excForDay.map((x) => ({ start_time: x.start_time, end_time: x.end_time, is_available: x.is_available }));
        } else {
          const defs = (defaults || []).filter((x) => x.day_of_week === dow);
          byDate[d] = defs.map((x) => ({ start_time: x.start_time, end_time: x.end_time, is_available: x.is_available }));
        }
      }

      // Generate 30-minute slots in UTC across the window for next N days
      const now = new Date();
      const slots: Array<{ start: string; end: string }> = [];
      for (const d of days) {
        const windows = byDate[d] || [];
        for (const w of windows) {
          if (!w.is_available) continue;
          const windowStartUtc = fromZonedTime(`${d} ${w.start_time}`, timezone);
          const windowEndUtc = fromZonedTime(`${d} ${w.end_time}`, timezone);
          // step 30 minutes
          for (let t = new Date(windowStartUtc); t < windowEndUtc; t = new Date(t.getTime() + 30 * 60 * 1000)) {
            const end = new Date(t.getTime() + 30 * 60 * 1000);
            if (end <= windowEndUtc && end > now) {
              slots.push({ start: t.toISOString(), end: end.toISOString() });
            }
          }
        }
      }
      // Subtract overlapping confirmed bookings from available slots
      const { data: existingBookings, error: bErr } = await supabase
        .from("consult_bookings")
        .select("start_datetime, end_datetime")
        .eq("guru_id", guruId)
        .eq("status", "confirmed")
        .lt("start_datetime", toDate.toISOString())
        .gt("end_datetime", fromDate.toISOString());
      if (bErr) return serverError("Failed to fetch existing bookings", bErr);
      const filteredSlots = slots.filter((s) => {
        const sStart = new Date(s.start).getTime();
        const sEnd = new Date(s.end).getTime();
        return !(existingBookings || []).some((b: any) => {
          const bStart = new Date(b.start_datetime).getTime();
          const bEnd = new Date(b.end_datetime).getTime();
          return sStart < bEnd && sEnd > bStart; // overlap
        });
      });

      // Optional limit via ?range=14days not needed here since from/to defines range, but keep client hint
      return json({ guru_id: guruId, availability: byDate, slots: filteredSlots });
    }

    // POST /api/bookings
    if (path.endsWith("/api/bookings") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized("Authentication required for bookings");
      
      // Check entitlement for booking creation
      const serviceClient = getServiceClient();
      const entitlementResult = await requireEntitlement(serviceClient, user.id, ['consults', 'premium']);
      if (!entitlementResult.ok) {
        return forbidden(entitlementResult.message);
      }
      const body = await req.json().catch(() => null) as any;
      if (!body) return badRequest("Invalid JSON body");
      const { guru_id, start_datetime_utc, end_datetime_utc, communication_method, notes } = body;
      if (!guru_id || !start_datetime_utc || !end_datetime_utc) return badRequest("guru_id, start_datetime_utc, end_datetime_utc required");

      // Fetch guru price and name
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("price_per_30min, full_name")
        .eq("user_id", guru_id)
        .maybeSingle();
      if (pErr) return serverError("Failed to get guru pricing", pErr);
      const price30 = Number(prof?.price_per_30min || 0);
      const start = new Date(start_datetime_utc);
      const end = new Date(end_datetime_utc);
      const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
      const units = Math.ceil(minutes / 30);
      const price = Math.max(0, units * price30);
      if (price <= 0) {
        // Instant confirmation for free consultations
        const meeting_link = ""; // will set below using booking id
        const { data, error } = await supabase
          .from("consult_bookings")
          .insert({
            guru_id,
            user_id: user.id,
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            status: "confirmed",
            payment_status: "paid",
            price: 0,
            communication_method: communication_method ?? null,
            notes: notes ?? null,
          })
          .select()
          .maybeSingle();
        if (error) return serverError("Failed to create booking", error);

        // Set meeting link to Jitsi room using booking_id (must use service role to bypass RLS on update)
        const svc = getServiceClient();
        const link = `https://meet.jit.si/${data.id}`;
        const { error: upErr } = await svc
          .from("consult_bookings")
          .update({ meeting_link: link })
          .eq("id", data.id);
        if (upErr) console.warn("Failed to update meeting link", upErr.message);

        // Schedule 1-hour reminder only
        const r1 = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
        await supabase.from("consult_reminders").insert([
          { booking_id: data.id, reminder_type: "one_hour_before", scheduled_time: r1 },
        ]);

        // Fire-and-forget confirmation emails
        sendBookingEmails(data.id).catch((e) => console.error("sendBookingEmails error", e));
        return json({ booking: { ...data, meeting_link: link } });
      }

      // Paid flow: create pending booking
      const { data, error } = await supabase
        .from("consult_bookings")
        .insert({
          guru_id,
          user_id: user.id,
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
          status: "pending_payment",
          payment_status: "unpaid",
          price,
          communication_method: communication_method ?? null,
          notes: notes ?? null,
        })
        .select()
        .maybeSingle();
      if (error) return serverError("Failed to create booking", error);
      return json({ booking: data });
    }

    // POST /api/payments
    if (path.endsWith("/api/payments") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized("Authentication required for payments");
      
      // Check entitlement for payment processing
      const serviceClient = getServiceClient();
      const entitlementResult = await requireEntitlement(serviceClient, user.id, ['consults', 'premium']);
      if (!entitlementResult.ok) {
        return forbidden(entitlementResult.message);
      }
      const body = await req.json().catch(() => null) as any;
      const { booking_id, provider } = body || {};
      if (!booking_id || !provider) return badRequest("booking_id and provider are required");
      if (provider !== "stripe") return badRequest("Only stripe is supported right now");

      const { data: booking, error: bErr } = await supabase
        .from("consult_bookings")
        .select("id, price, status, guru_id, start_datetime, end_datetime")
        .eq("id", booking_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (bErr) return serverError("Failed to fetch booking", bErr);
      if (!booking) return notFound("Booking not found");
      if (booking.status !== "pending_payment") return badRequest("Booking is not pending payment");

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (!stripeKey) return serverError("Stripe secret key not configured");
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      const frontOrigin = req.headers.get("origin") || url.origin;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email ?? undefined,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "Consultation" },
            unit_amount: Math.round(Number(booking.price) * 100),
          },
          quantity: 1,
        }],
        metadata: {
          booking_id: booking.id,
          guru_id: booking.guru_id,
          start: booking.start_datetime,
          end: booking.end_datetime,
          email: user.email || "",
        },
        success_url: `${frontOrigin}/consultations?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontOrigin}/consultations?payment=cancelled`,
      });

      // Create payment row (pending)
      const { error: pInsErr } = await supabase.from("consult_payments").insert({
        booking_id: booking.id,
        amount: booking.price,
        currency: "usd",
        payment_method: "stripe",
        status: "pending",
      });
      if (pInsErr) console.warn("Payment insert warning:", pInsErr.message);

      return json({ checkout_url: session.url });
    }

    // POST /api/payments/verify { session_id }
    if (path.endsWith("/api/payments/verify") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized("Authentication required for payment verification");
      
      // Check entitlement for payment verification
      const serviceClient = getServiceClient();
      const entitlementResult = await requireEntitlement(serviceClient, user.id, ['consults', 'premium']);
      if (!entitlementResult.ok) {
        return forbidden(entitlementResult.message);
      }
      const { session_id } = await req.json().catch(() => ({}));
      if (!session_id) return badRequest("session_id required");

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") return badRequest("Payment not completed yet");

      const bookingId = (session.metadata?.booking_id as string) || null;
      if (!bookingId) return badRequest("No booking_id on session");

      // Update payment & booking
      const receiptUrl = session.invoice ? undefined : session.url || undefined;
      const { error: upPayErr } = await supabase
        .from("consult_payments")
        .update({ status: "completed", transaction_id: session.id, receipt_url: receiptUrl })
        .eq("booking_id", bookingId)
        .eq("status", "pending");
      if (upPayErr) console.warn("Payment update warning:", upPayErr.message);

      // Set meeting link to Jitsi room using booking_id
      const meeting_link = `https://meet.jit.si/${bookingId}`;
      const { error: upBookErr } = await supabase
        .from("consult_bookings")
        .update({ status: "confirmed", payment_status: "paid", meeting_link })
        .eq("id", bookingId)
        .eq("user_id", user.id);
      if (upBookErr) return serverError("Failed to confirm booking", upBookErr);

      // Schedule 1-hour reminder only
      const { data: booking, error: bErr } = await supabase
        .from("consult_bookings")
        .select("start_datetime")
        .eq("id", bookingId)
        .maybeSingle();
      if (!bErr && booking?.start_datetime) {
        const start = new Date(booking.start_datetime);
        const r1 = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
        await supabase.from("consult_reminders").insert([
          { booking_id: bookingId, reminder_type: "one_hour_before", scheduled_time: r1 },
        ]);
      }

      // Send confirmation emails
      sendBookingEmails(bookingId).catch((e) => console.error("sendBookingEmails error", e));

      return json({ ok: true, booking_id: bookingId });
    }

    // POST /api/bookings/:id/cancel
    const cancelMatch = path.match(/\/api\/bookings\/([^/]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const bookingId = cancelMatch[1];

      const { data: booking, error: be } = await supabase
        .from("consult_bookings")
        .select("id, user_id, guru_id, start_datetime, end_datetime, status, payment_status, price")
        .eq("id", bookingId)
        .maybeSingle();
      if (be) return serverError("Failed to fetch booking", be);
      if (!booking) return notFound("Booking not found");
      if (booking.user_id !== user.id) return unauthorized();
      if (booking.status !== "confirmed") return badRequest("Only confirmed bookings can be cancelled");
      if (new Date(booking.start_datetime) <= new Date()) return badRequest("Cannot cancel past or ongoing bookings");

      let wasPaid = Number(booking.price || 0) > 0 && booking.payment_status === "paid";
      if (wasPaid) {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
        if (!stripeKey) return serverError("Stripe secret key not configured");
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

        const { data: payment } = await supabase
          .from("consult_payments")
          .select("transaction_id")
          .eq("booking_id", bookingId)
          .eq("status", "completed")
          .maybeSingle();

        if (!payment || !payment.transaction_id) {
          console.warn("No completed payment row found for refund", { bookingId });
          wasPaid = false;
        } else {
          const session = await stripe.checkout.sessions.retrieve(payment.transaction_id);
          const payment_intent = (session.payment_intent as string | null) || null;
          if (!payment_intent) return serverError("Payment intent not found on session");
          await stripe.refunds.create({ payment_intent });
          await supabase.from("consult_payments").update({ status: "refunded" }).eq("booking_id", bookingId);
        }
      }

      const newStatus = wasPaid ? "cancelled_refunded" : "cancelled";
      const newPay = wasPaid ? "refunded" : "unpaid";
      const { error: upErr } = await supabase
        .from("consult_bookings")
        .update({ status: newStatus, payment_status: newPay })
        .eq("id", bookingId)
        .eq("user_id", user.id);
      if (upErr) return serverError("Failed to cancel booking", upErr);

      // Restore availability as a dated slot (exception) so others can rebook
      try {
        const svc = getServiceClient();
        const { data: tzRow } = await svc
          .from('profiles')
          .select('timezone')
          .eq('user_id', booking.guru_id)
          .maybeSingle();
        const tz = (tzRow as any)?.timezone || 'UTC';
        const dStart = new Date(booking.start_datetime);
        const dEnd = new Date((booking as any).end_datetime || booking.start_datetime);
        const dFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
        const dateStr = dFmt.format(dStart);
        const tFmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
        const getHM = (d: Date) => {
          const parts = tFmt.formatToParts(d);
          const h = parts.find(p => p.type === 'hour')?.value || '00';
          const m = parts.find(p => p.type === 'minute')?.value || '00';
          return `${h}:${m}:00`;
        };
        const startLocal = getHM(dStart);
        const endLocal = getHM(dEnd);
        await svc.from('consult_availability').insert({
          guru_id: booking.guru_id,
          type: 'exception',
          date: dateStr,
          start_time: startLocal,
          end_time: endLocal,
          is_available: true,
        });
      } catch (e) {
        console.warn('Failed to restore availability slot on cancel', e);
      }

      // Emails
      sendCancellationEmails(bookingId, wasPaid).catch((e) => console.error("sendCancellationEmails error", e));

      return json({ ok: true, status: newStatus, wasPaid });
    }

    // GET /api/guru/bookings (auth:guru)
    if (path.endsWith("/api/guru/bookings") && req.method === "GET") {
      if (!(await hasRole(req, "guru"))) return unauthorized("Guru role required");
      const user = await getAuthUser(req);
      const { data, error } = await supabase
        .from("consult_bookings")
        .select("id, user_id, start_datetime, end_datetime, status, price, payment_status, communication_method, notes")
        .eq("guru_id", user!.id)
        .order("start_datetime", { ascending: false });
      if (error) return serverError("Failed to fetch guru bookings", error);
      return json({ items: data });
    }

    // POST /api/guru/availability (auth:guru)
    if (path.endsWith("/api/guru/availability") && req.method === "POST") {
      if (!(await hasRole(req, "guru"))) return unauthorized("Guru role required");
      const user = await getAuthUser(req);
      const body = await req.json().catch(() => null) as any;
      if (!body) return badRequest("Invalid body");
      const payload = { ...body, guru_id: user!.id };
      const { data, error } = await supabase.from("consult_availability").insert(payload).select().maybeSingle();
      if (error) return serverError("Failed to create availability", error);
      return json({ availability: data });
    }

    // PATCH /api/guru/availability/:id (auth:guru)
    const patchAvail = path.match(/\/api\/guru\/availability\/([^/]+)$/);
    if (patchAvail && req.method === "PATCH") {
      if (!(await hasRole(req, "guru"))) return unauthorized("Guru role required");
      const user = await getAuthUser(req);
      const id = patchAvail[1];
      const body = await req.json().catch(() => null) as any;
      const { data, error } = await supabase
        .from("consult_availability")
        .update(body)
        .eq("id", id)
        .eq("guru_id", user!.id)
        .select()
        .maybeSingle();
      if (error) return serverError("Failed to update availability", error);
      return json({ availability: data });
    }

    // DELETE /api/guru/availability/:id (auth:guru)
    const delAvail = path.match(/\/api\/guru\/availability\/([^/]+)$/);
    if (delAvail && req.method === "DELETE") {
      if (!(await hasRole(req, "guru"))) return unauthorized("Guru role required");
      const user = await getAuthUser(req);
      const id = delAvail[1];
      const { error } = await supabase
        .from("consult_availability")
        .delete()
        .eq("id", id)
        .eq("guru_id", user!.id);
      if (error) return serverError("Failed to delete availability", error);
      return json({ ok: true });
    }

    // GET /api/admin/revenue?from=&to=&guru_id=
    if (path.endsWith("/api/admin/revenue") && req.method === "GET") {
      if (!(await hasRole(req, "admin"))) return unauthorized("Admin role required");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const guru_id = url.searchParams.get("guru_id");
      let query = supabase
        .from("consult_payments")
        .select("amount, created_at, booking:consult_bookings!inner(guru_id)")
        .eq("status", "completed");
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      if (guru_id) query = query.eq("booking.guru_id", guru_id);
      const { data, error } = await query;
      if (error) return serverError("Failed to compute revenue", error);
      const total = (data || []).reduce((sum, r: any) => sum + Number(r.amount || 0), 0);
      return json({ total, currency: "usd", count: data?.length || 0 });
    }

    // POST /api/reminders/send (admin)
    if (path.endsWith("/api/reminders/send") && req.method === "POST") {
      if (!(await hasRole(req, "admin"))) return unauthorized("Admin role required");
      const nowIso = new Date().toISOString();
      const { data: due, error } = await supabase
        .from("consult_reminders")
        .select("id, booking_id")
        .lte("scheduled_time", nowIso)
        .eq("sent_status", false)
        .eq("reminder_type", "one_hour_before");
      if (error) return serverError("Failed to fetch due reminders", error);

      const ids = (due || []).map((r: any) => r.id);
      // Send emails
      await Promise.all((due || []).map((r: any) => sendReminderEmails(r.booking_id).catch((e) => console.error("reminder send error", e))));

      if (ids.length > 0) {
        const { error: upErr } = await supabase
          .from("consult_reminders")
          .update({ sent_status: true })
          .in("id", ids);
        if (upErr) return serverError("Failed to mark reminders sent", upErr);
      }
      return json({ processed: ids.length });
    }

    return notFound();
  } catch (err) {
    return serverError("Unhandled error", err);
  }
}

serve(handle);
