import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const payloadSchema = z.object({
  items: z.array(z.object({
    title: z.string().min(3),
    slug: z.string().optional(),
    html: z.string().min(1),
    excerpt: z.string().optional(),
    cover_image_url: z.string().url().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author_email: z.string().email().optional(),
    published_at: z.string().datetime().optional(),
  })),
});

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

function readingMinutesFromHtml(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: user } = await supabase.auth.getUser(token);
    if (!user?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Require admin
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = payloadSchema.parse(await req.json());

    let imported = 0;
    for (const item of body.items) {
      // Category ensure
      let category_id: string | null = null;
      if (item.category) {
        const catSlug = slugify(item.category);
        const existing = await supabase.from("blog_categories").select("id").eq("slug", catSlug).maybeSingle();
        if (existing.data) category_id = existing.data.id;
        else {
          const { data: created } = await supabase
            .from("blog_categories")
            .insert({ slug: catSlug, title: item.category, description: null })
            .select("id")
            .maybeSingle();
          category_id = created?.id ?? null;
        }
      }

      // Tags ensure
      let tagIds: string[] = [];
      if (item.tags && item.tags.length) {
        for (const t of item.tags) {
          const tSlug = slugify(t);
          const { data: row } = await supabase.from("blog_tags").select("id").eq("slug", tSlug).maybeSingle();
          if (row) tagIds.push(row.id);
          else {
            const { data: created } = await supabase
              .from("blog_tags")
              .insert({ slug: tSlug, title: t })
              .select("id")
              .maybeSingle();
            if (created) tagIds.push(created.id);
          }
        }
      }

      // Author resolve by email or placeholder
      let author_id: string | null = null;
      if (item.author_email) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", item.author_email)
          .maybeSingle();
        if (prof?.user_id) author_id = prof.user_id;
      }
      if (!author_id) {
        // create placeholder profile
        const { data: ids } = await supabase.rpc("uuid_generate_v4"); // may not be available
        const placeholder = (ids as any)?.[0]?.uuid ?? crypto.randomUUID();
        await supabase.from("profiles").insert({ user_id: placeholder, email: item.author_email ?? `placeholder+${crypto.randomUUID()}@example.com`, full_name: "Imported Author" });
        await supabase.from("user_roles").insert({ user_id: placeholder, role: "user" });
        author_id = placeholder;
      }

      const slug = item.slug ? slugify(item.slug) : slugify(item.title);
      const minutes = readingMinutesFromHtml(item.html);

      // Upsert post by slug
      const { data: existingPost } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
      let post_id: string;
      if (existingPost) {
        const { data: updated } = await supabase
          .from("blog_posts")
          .update({
            title: item.title,
            slug,
            excerpt: item.excerpt ?? null,
            cover_image_url: item.cover_image_url ?? null,
            content_html: item.html,
            reading_minutes: minutes,
            status: "published",
            author_id,
            category_id,
            published_at: item.published_at ?? new Date().toISOString(),
          })
          .eq("id", existingPost.id)
          .select("id")
          .maybeSingle();
        post_id = updated!.id;
      } else {
        const { data: inserted } = await supabase
          .from("blog_posts")
          .insert({
            title: item.title,
            slug,
            excerpt: item.excerpt ?? null,
            cover_image_url: item.cover_image_url ?? null,
            content_html: item.html,
            reading_minutes: minutes,
            status: "published",
            author_id,
            category_id,
            published_at: item.published_at ?? new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        post_id = inserted!.id;
      }

      // Link tags
      if (tagIds.length) {
        const links = tagIds.map((tid) => ({ post_id, tag_id: tid }));
        await supabase.from("blog_post_tags").insert(links).onConflict("post_id,tag_id").ignore();
      }

      imported++;
    }

    return new Response(JSON.stringify({ success: true, imported }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-legacy-blogs error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unexpected error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
