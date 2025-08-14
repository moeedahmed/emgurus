import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeadersBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveCorsOrigin(req: Request): string {
  try {
    const allowlist = (Deno.env.get("ORIGIN_ALLOWLIST") || "").split(/[,\s]+/).filter(Boolean);
    const origin = req.headers.get("origin") || "*";
    if (!allowlist.length) return "*";
    return allowlist.includes(origin) ? origin : allowlist[0] || "*";
  } catch {
    return "*";
  }
}

serve(async (req) => {
  const corsOrigin = resolveCorsOrigin(req);
  const corsHeaders = { ...corsHeadersBase, "Access-Control-Allow-Origin": corsOrigin } as Record<string,string>;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    const urlObj = new URL(req.url);
    const q = urlObj.searchParams.get("q")?.trim() || "";
    const category = urlObj.searchParams.get("category") || "";
    const author = urlObj.searchParams.get("author") || "";
    const tag = urlObj.searchParams.get("tag") || "";
    const sort = urlObj.searchParams.get("sort") || "newest";
    const page = Math.max(1, Number(urlObj.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(urlObj.searchParams.get("page_size") || 12)));

    let query = admin
      .from("blog_posts")
      .select("id, author_id, title, slug, description, cover_image_url, created_at, category_id, view_count", { count: "exact" })
      .eq("status", "published");

    // Apply filters
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (category) {
      const { data: cat } = await admin.from("blog_categories").select("id").eq("slug", category).maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }
    if (author) {
      query = query.eq("author_id", author);
    }

    // Sorting
    switch (sort) {
      case "liked":
        query = query.order("view_count", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "discussed":
        query = query.order("created_at", { ascending: false }); // Approximate for now
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // TODO: Handle tag filtering and get additional metadata like reactions/comments
    // For now, keeping it simple with basic filtering

    const items = (data || []).map((p: any) => ({
      id: p.id,
      author_id: p.author_id,
      title: p.title,
      slug: p.slug,
      excerpt: p.description ?? null,
      cover_image_url: p.cover_image_url ?? null,
      created_at: p.created_at,
    }));

    return new Response(JSON.stringify({ 
      items, 
      count: count ?? items.length,
      page,
      page_size: pageSize,
      total: count ?? items.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
