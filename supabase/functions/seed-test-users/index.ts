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
  { email: "admin@emgurus.com", password: "Test1234!", full_name: "Admin User", role: "admin" },
  { email: "guru@emgurus.com", password: "Test1234!", full_name: "Guru User", role: "guru" },
  { email: "user@emgurus.com", password: "Test1234!", full_name: "Test User", role: "user" },
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

    const results: any[] = [];
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

      // Upsert role
      await supabase.from("user_roles").upsert({ user_id: userId, role: u.role }).select();
      // Upsert profile for convenience
      await supabase
        .from("profiles")
        .upsert({ user_id: userId, email: u.email, full_name: u.full_name })
        .select();

      results.push({ email: u.email, role: u.role });
    }

    return new Response(
      JSON.stringify({ success: true, users: results, defaultPassword: "Test1234!" }),
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
