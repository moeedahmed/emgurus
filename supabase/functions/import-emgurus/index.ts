import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import FirecrawlApp from "https://esm.sh/@mendable/firecrawl-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CrawlItem {
  url?: string;
  markdown?: string;
  html?: string;
  metadata?: { title?: string; description?: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } });
  const supabaseService = createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authData.user) throw new Error("User not authenticated");
    const user = authData.user;

    // Check role (admin or guru)
    const { data: roles, error: roleError } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (roleError) throw roleError;
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    const isGuru = roles?.some((r: any) => r.role === "guru");
    if (!isAdmin && !isGuru) throw new Error("Insufficient permissions");

    const body = await req.json().catch(() => ({}));
    const targetUrl: string = body.url || "https://emgurus.com";
    const limit: number = body.limit || 20;

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") || "";
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const app = new FirecrawlApp({ apiKey: firecrawlKey });

    const crawlResponse: any = await app.crawlUrl(targetUrl, {
      limit,
      scrapeOptions: { formats: ["markdown", "html"] },
    });

    if (!crawlResponse?.success) {
      throw new Error(crawlResponse?.error || "Crawl failed");
    }

    const items: CrawlItem[] = crawlResponse.data || [];

    // Ensure Imported category exists
    const importedSlug = "imported";
    let importedCategoryId: string | null = null;
    const { data: existingCat } = await supabaseService
      .from("blog_categories")
      .select("id")
      .eq("slug", importedSlug)
      .maybeSingle();
    if (existingCat?.id) {
      importedCategoryId = existingCat.id;
    } else {
      const { data: newCat, error: catErr } = await supabaseService
        .from("blog_categories")
        .insert({ name: "Imported", slug: importedSlug })
        .select("id")
        .single();
      if (catErr) throw catErr;
      importedCategoryId = newCat.id;
    }

    let imported = 0;
    for (const item of items) {
      const url = item.url || "";
      const title = item.metadata?.title?.trim() || url.split("/").filter(Boolean).slice(-1)[0]?.replace(/[-_]/g, " ") || "Imported Article";
      const markdown = item.markdown || "";
      if (title.length < 4 || markdown.length < 50) continue; // skip thin content

      const slug = (url || title)
        .toLowerCase()
        .replace(/https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const description = (item.metadata?.description || markdown.replace(/[#>*_`\-\n]+/g, " ").slice(0, 156)).trim();

      // Avoid duplicates by slug if exists
      const { data: existing } = await supabaseService
        .from("blog_posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existing?.id) {
        await supabaseService
          .from("blog_posts")
          .update({
            title,
            description,
            content: markdown,
            category_id: importedCategoryId,
            status: "published",
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        imported += 1;
      } else {
        const { error: insertErr } = await supabaseService.from("blog_posts").insert({
          author_id: user.id,
          title,
          description,
          cover_image_url: null,
          category_id: importedCategoryId,
          content: markdown,
          status: "published",
          slug,
          tags: null,
        });
        if (!insertErr) imported += 1;
      }
    }

    return new Response(JSON.stringify({ success: true, imported }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("import-emgurus error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
