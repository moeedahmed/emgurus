// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeedUserSpec {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "guru" | "user";
}

const mkUsers = (): SeedUserSpec[] => {
  const out: SeedUserSpec[] = [];
  // Admins (5)
  const adminEmails = [
    "testadmin@emgurus.com",
    ...Array.from({ length: 4 }, (_, i) => `testadmin${i + 2}@emgurus.com`),
  ];
  adminEmails.forEach((email, idx) => out.push({
    email,
    password: "Password123!",
    full_name: idx === 0 ? "Test Admin" : `Test Admin ${idx + 1}`,
    role: "admin",
  }));

  // Gurus (5)
  const guruEmails = [
    "testguru@emgurus.com",
    ...Array.from({ length: 4 }, (_, i) => `testguru${i + 2}@emgurus.com`),
  ];
  guruEmails.forEach((email, idx) => out.push({
    email,
    password: "Password123!",
    full_name: idx === 0 ? "Test Guru" : `Test Guru ${idx + 1}`,
    role: "guru",
  }));

  // Users (5)
  const userEmails = [
    "testuser@emgurus.com",
    ...Array.from({ length: 4 }, (_, i) => `testuser${i + 2}@emgurus.com`),
  ];
  userEmails.forEach((email, idx) => out.push({
    email,
    password: "Password123!",
    full_name: idx === 0 ? "Test User" : `Test User ${idx + 1}`,
    role: "user",
  }));

  return out;
};

const USERS: SeedUserSpec[] = mkUsers();

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing Supabase envs");
  return createClient(url, serviceKey);
}

export async function serve(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated admin
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) throw new Error("Missing Supabase envs");

    const supabaseAnon = createClient(url, anonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check admin role using user's own permissions
    const { data: roles, error: rolesError } = await supabaseAnon
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (rolesError) throw rolesError;
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = getAdminClient();

    // Seed profile data keyed by email
const PROFILE_DATA: Record<string, any> = {
  // Provide richer profiles for a few accounts; test* accounts will fall back to minimal upsert
  "testadmin@emgurus.com": { title: null, specialty: "Emergency Medicine", country: "UK", exams: ["FRCEM"], price_per_30min: 0, timezone: "Europe/London", bio: "Platform administrator." },
  "testguru@emgurus.com": { specialty: "Emergency Medicine", country: "UK", exams: ["MRCEM SBA"], price_per_30min: 50, timezone: "Europe/London", bio: "Experienced EM mentor." },
  "testuser@emgurus.com": { country: "UK", timezone: "Europe/London" },
};

    const results: any[] = [];
    const idByEmail: Record<string, string> = {};
    for (const u of USERS) {
      // Try to create user
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });

      let userId = created?.user?.id as string | undefined;

      if (createError && !userId) {
        // If exists, fetch from list and find id by email
        const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = listed?.users?.find((x: any) => x.email?.toLowerCase() === u.email.toLowerCase());
        userId = found?.id;
      }

      if (!userId) throw new Error(`Unable to resolve user id for ${u.email}`);

      idByEmail[u.email] = userId;

      // Upsert role
      await supabase.from("user_roles").upsert({ user_id: userId, role: u.role }).select();
      // Upsert profile with extended data
      const pd = PROFILE_DATA[u.email] || {};
      await supabase
        .from("profiles")
        .upsert({ user_id: userId, email: u.email, full_name: u.full_name, ...pd })
        .select();

      results.push({ email: u.email, role: u.role });
    }

    // Additional seed data for consultations
    try {
      // Availability defaults for Dr Ayesha Khan (Mon–Fri 09:00–12:00)
      const guruKhanId = idByEmail["guru.khan@emgurus.com"];
      if (guruKhanId) {
        for (let d = 1; d <= 5; d++) {
          await supabase.from("consult_availability").insert({
            guru_id: guruKhanId,
            type: "default",
            day_of_week: d,
            start_time: "09:00:00",
            end_time: "12:00:00",
            is_available: true,
          });
        }
      }

      // Exception - Dr Bilal Raza unavailable today
      const guruRazaId = idByEmail["guru.raza@emgurus.com"];
      if (guruRazaId) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("consult_availability").insert({
          guru_id: guruRazaId,
          type: "exception",
          date: today,
          start_time: "00:00:00",
          end_time: "23:59:59",
          is_available: false,
        });
      }

      // Sample confirmed free booking for Dr Jane Smith with Moeed Ahmed two days from now at 09:00 UTC
      const guruSmithId = idByEmail["guru.smith@emgurus.com"];
      const userAhmedId = idByEmail["user.ahmed@emgurus.com"];
      if (guruSmithId && userAhmedId) {
        const now = new Date();
        const start = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 2,
          9, 0, 0, 0
        ));
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        await supabase.from("consult_bookings").insert({
          guru_id: guruSmithId,
          user_id: userAhmedId,
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
          status: "confirmed",
          price: 0,
          payment_status: "paid",
          communication_method: "google_meet",
          meeting_link: "https://meet.google.com/demo-link",
          notes: "Seed booking",
        });
      }

      // Seed weekly default availability for requested gurus
      const weeklyDefs = [
        { email: "aisha.khan@emgurus.com", day: 1, start: "09:00:00", end: "12:00:00" },
        { email: "miguel.santos@emgurus.com", day: 2, start: "15:00:00", end: "18:00:00" },
        { email: "sarah.lee@emgurus.com", day: 3, start: "08:00:00", end: "10:00:00" },
        { email: "imran.bashir@emgurus.com", day: 4, start: "17:00:00", end: "20:00:00" },
        { email: "kavya.ramesh@emgurus.com", day: 5, start: "10:00:00", end: "13:00:00" },
      ];
      for (const w of weeklyDefs) {
        const gid = idByEmail[w.email];
        if (!gid) continue;
        // Avoid duplicates for the same day
        await supabase
          .from("consult_availability")
          .delete()
          .eq("guru_id", gid)
          .eq("type", "default")
          .eq("day_of_week", w.day);
        await supabase.from("consult_availability").insert({
          guru_id: gid,
          type: "default",
          day_of_week: w.day,
          start_time: w.start,
          end_time: w.end,
          is_available: true,
        });
      }
    } catch (seedErr) {
      console.error("Additional seed error", seedErr);
    }

    return new Response(
      JSON.stringify({ success: true, users: results, defaultPassword: "Password123!" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error("Seeding error", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

// @ts-ignore - Deno entrypoint
Deno.serve(serve);
