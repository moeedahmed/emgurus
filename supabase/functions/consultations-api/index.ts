// Consultations API - Supabase Edge Function
// Provides REST endpoints per the EMGurus contract via a single function router.
// Auth: Public for read-only guru discovery; JWT required for bookings, payments, guru/admin actions.
// Docs: Swagger UI at /api/docs and OpenAPI JSON at /api/openapi.json

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fromZonedTime } from "https://esm.sh/date-fns-tz@3.0.0";
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
        .select("user_id, full_name, avatar_url, specialty, country, exams, price_per_30min, timezone, bio", { count: "exact" });
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

      // Optional limit via ?range=14days not needed here since from/to defines range, but keep client hint
      return json({ guru_id: guruId, availability: byDate, slots });
    }

    // POST /api/bookings
    if (path.endsWith("/api/bookings") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const body = await req.json().catch(() => null) as any;
      if (!body) return badRequest("Invalid JSON body");
      const { guru_id, start_datetime_utc, end_datetime_utc, communication_method, notes } = body;
      if (!guru_id || !start_datetime_utc || !end_datetime_utc) return badRequest("guru_id, start_datetime_utc, end_datetime_utc required");

      // Fetch guru price
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("price_per_30min")
        .eq("user_id", guru_id)
        .maybeSingle();
      if (pErr) return serverError("Failed to get guru pricing", pErr);
      const price30 = Number(prof?.price_per_30min || 0);
      const start = new Date(start_datetime_utc);
      const end = new Date(end_datetime_utc);
      const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
      const units = Math.ceil(minutes / 30);
      const price = Math.max(0, units * price30);

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
      if (!user) return unauthorized();
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
        success_url: `${url.origin}/consultations?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${url.origin}/consultations?payment=cancelled`,
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
      if (!user) return unauthorized();
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

      // Create placeholder meeting link if not set
      const meeting_link = `https://meet.jit.si/emgurus-${bookingId}`;
      const { error: upBookErr } = await supabase
        .from("consult_bookings")
        .update({ status: "confirmed", payment_status: "paid", meeting_link })
        .eq("id", bookingId)
        .eq("user_id", user.id);
      if (upBookErr) return serverError("Failed to confirm booking", upBookErr);

      // Schedule reminders: 24h and 1h before start
      const { data: booking, error: bErr } = await supabase
        .from("consult_bookings")
        .select("start_datetime")
        .eq("id", bookingId)
        .maybeSingle();
      if (!bErr && booking?.start_datetime) {
        const start = new Date(booking.start_datetime);
        const r24 = new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const r1 = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
        await supabase.from("consult_reminders").insert([
          { booking_id: bookingId, reminder_type: "email", scheduled_time: r24 },
          { booking_id: bookingId, reminder_type: "email", scheduled_time: r1 },
        ]);
      }

      return json({ ok: true, booking_id: bookingId });
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
      const { data, error } = await supabase
        .from("consult_reminders")
        .select("id")
        .lte("scheduled_time", nowIso)
        .eq("sent_status", false);
      if (error) return serverError("Failed to fetch due reminders", error);
      const ids = (data || []).map((r: any) => r.id);
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
