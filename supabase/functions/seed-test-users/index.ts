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

const USERS: SeedUserSpec[] = [
  { email: "admin@emgurus.com", password: "Password123!", full_name: "Admin User", role: "admin" },
  { email: "guru@emgurus.com", password: "Password123!", full_name: "Guru User", role: "guru" },
  { email: "user@emgurus.com", password: "Password123!", full_name: "Test User", role: "user" },
  { email: "guru.khan@emgurus.com", password: "Password123!", full_name: "Dr Ayesha Khan", role: "guru" },
  { email: "guru.raza@emgurus.com", password: "Password123!", full_name: "Dr Bilal Raza", role: "guru" },
  { email: "guru.smith@emgurus.com", password: "Password123!", full_name: "Dr Jane Smith", role: "guru" },
  { email: "user.ahmed@emgurus.com", password: "Password123!", full_name: "Moeed Ahmed", role: "user" },
  { email: "user.ali@emgurus.com", password: "Password123!", full_name: "Dr Ali", role: "user" },
];

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
      "admin@emgurus.com": { title: null, specialty: "Emergency Medicine", country: "UK", exams: ["FRCEM"], price_per_30min: 0, timezone: "Europe/London", bio: "Platform administrator." },
      "guru@emgurus.com": { specialty: "Emergency Medicine" },
      "user@emgurus.com": {},
      "guru.khan@emgurus.com": { specialty: "Emergency Medicine", country: "UK", exams: ["MRCEM SBA","FRCEM SBA"], price_per_30min: 40, timezone: "Europe/London", bio: "FRCEM examiner, 10+ yrs EM." },
      "guru.raza@emgurus.com": { specialty: "Emergency Medicine", country: "Pakistan", exams: ["FCPS EM","MRCEM SBA"], price_per_30min: 20, timezone: "Asia/Karachi", bio: "FCPS EM mentor and MRCEM coach." },
      "guru.smith@emgurus.com": { specialty: "Paediatric EM", country: "UK", exams: ["MRCEM Primary"], price_per_30min: 0, timezone: "Europe/London", bio: "Paeds EM specialist (free intro slots)." },
      "user.ahmed@emgurus.com": { country: "UK", timezone: "Europe/London", exams: ["MRCEM SBA"] },
      "user.ali@emgurus.com": { country: "Pakistan", timezone: "Asia/Karachi", exams: ["FCPS EM"] },
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
