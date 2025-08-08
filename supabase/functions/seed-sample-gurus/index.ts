import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GuruSpec = {
  email: string;
  password: string;
  full_name: string;
  specialty: string;
  country: string;
  exams: string[];
  price_per_30min: number;
  bio: string;
  timezone: string;
};

const GURUS: GuruSpec[] = [
  {
    email: "emily.carter@example.com",
    password: "Password123!",
    full_name: "Dr. Emily Carter",
    specialty: "Emergency Medicine",
    country: "United Kingdom",
    exams: ["MRCEM SBA", "FRCEM SBA"],
    price_per_30min: 60,
    bio: "UK-based EM physician and exam mentor.",
    timezone: "Europe/London",
  },
  {
    email: "jason.miller@example.com",
    password: "Password123!",
    full_name: "Dr. Jason Miller",
    specialty: "Pediatrics",
    country: "United States",
    exams: ["USMLE", "PALS"],
    price_per_30min: 70,
    bio: "Pediatric specialist focused on USMLE prep.",
    timezone: "America/New_York",
  },
  {
    email: "leila.almansoori@example.com",
    password: "Password123!",
    full_name: "Dr. Leila Al Mansoori",
    specialty: "Emergency Medicine",
    country: "United Arab Emirates",
    exams: ["Arab Board", "ACLS"],
    price_per_30min: 55,
    bio: "UAE-based consultant with Arab Board expertise.",
    timezone: "Asia/Dubai",
  },
  {
    email: "arjun.mehta@example.com",
    password: "Password123!",
    full_name: "Dr. Arjun Mehta",
    specialty: "Internal Medicine",
    country: "India",
    exams: ["MRCP Part 1", "ACLS"],
    price_per_30min: 40,
    bio: "Indian internal medicine mentor and examiner.",
    timezone: "Asia/Kolkata",
  },
  {
    email: "sophie.nguyen@example.com",
    password: "Password123!",
    full_name: "Dr. Sophie Nguyen",
    specialty: "Anesthesiology",
    country: "Australia",
    exams: ["ANZCA Part 1", "BLS"],
    price_per_30min: 50,
    bio: "Australia-based anesthesiologist guiding ANZCA prep.",
    timezone: "Australia/Sydney",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ success: false, error: "Supabase env not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  // Admin client (service role) for user creation and privileged writes
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Public client for RLS-aware operations when needed
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { auth: { persistSession: false } });

  try {
    // Quick idempotency: if we already have >= 5 guru profiles, bail out
    const { count } = await anon
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .filter("user_id", "in", `(${(await (async () => {
        // any profile that is a guru according to policy; we can't call policy in head mode,
        // so do a broad count and still proceed safely; idempotent inserts will no-op
        return ""; // placeholder; count head will count all profiles but that's okay for idempotency
      })())})`);
    if ((count ?? 0) >= 5) {
      // still proceed to ensure specific 5 exist (idempotent upserts below)
    }

    const created: Array<{ email: string; id: string }> = [];

    for (const g of GURUS) {
      // Create or fetch user by email
      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email: g.email,
        password: g.password,
        email_confirm: true,
        user_metadata: { full_name: g.full_name },
      });

      let userId = createRes?.user?.id ?? null;
      if (!userId) {
        // Possibly exists; list users and find by email
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listErr) throw listErr;
        const existing = list.users.find((u) => (u.email || "").toLowerCase() === g.email.toLowerCase());
        if (!existing) throw new Error(`Unable to create or find user for ${g.email}`);
        userId = existing.id;
      }
      created.push({ email: g.email, id: userId! });

      // Ensure guru role exists
      const { data: roleExists } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "guru")
        .maybeSingle();
      if (!roleExists) {
        await admin.from("user_roles").insert({ user_id: userId, role: "guru" });
      }

      // Upsert profile fields
      const { data: prof } = await admin
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (prof) {
        await admin
          .from("profiles")
          .update({
            email: g.email,
            full_name: g.full_name,
            specialty: g.specialty,
            country: g.country,
            exams: g.exams,
            price_per_30min: g.price_per_30min,
            bio: g.bio,
            timezone: g.timezone,
          })
          .eq("id", prof.id);
      } else {
        await admin.from("profiles").insert({
          user_id: userId,
          email: g.email,
          full_name: g.full_name,
          specialty: g.specialty,
          country: g.country,
          exams: g.exams,
          price_per_30min: g.price_per_30min,
          bio: g.bio,
          timezone: g.timezone,
        });
      }

      // Seed default weekly availability (Mon-Fri = 1..5) 10:00-14:00
      for (const dow of [1, 2, 3, 4, 5]) {
        const { data: existingSlot } = await admin
          .from("consult_availability")
          .select("id")
          .eq("guru_id", userId)
          .eq("type", "default")
          .eq("day_of_week", dow)
          .maybeSingle();
        if (!existingSlot) {
          await admin.from("consult_availability").insert({
            guru_id: userId,
            type: "default",
            day_of_week: dow,
            start_time: "10:00",
            end_time: "14:00",
            is_available: true,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("seed-sample-gurus error", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
