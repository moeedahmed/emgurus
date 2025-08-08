import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function getClient(req: Request) {
  const auth = req.headers.get("Authorization");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth ?? "" } },
    auth: { persistSession: false },
  });
}

async function getUserRoleFlags(supabase: ReturnType<typeof getClient>, userId?: string) {
  if (!userId) return { isAdmin: false, isGuru: false };
  const [{ data: isAdmin }, { data: isGuru }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "guru" }),
  ]);
  return { isAdmin: !!isAdmin, isGuru: !!isGuru };
}

const createDraftSchema = z.object({
  title: z.string().min(3),
  content_md: z.string().optional(),
  content_html: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tag_slugs: z.array(z.string()).optional(),
  cover_image_url: z.string().url().optional(),
  excerpt: z.string().optional(),
});

const reviewSchema = z.object({
  notes: z.string().optional(),
  is_featured: z.boolean().optional(),
  is_editors_pick: z.boolean().optional(),
});

const reactSchema = z.object({
  reaction: z.enum([
    "like",
    "love",
    "insightful",
    "curious",
    "thumbs_up",
    "thumbs_down",
  ]),
});

const commentSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().uuid().nullable().optional(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function readingMinutesFrom({ md, html }: { md?: string; html?: string }) {
  const text = md ?? (html ? stripHtml(html) : "");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/^\/+/, "/");
    const supabase = getClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // GET /api/blogs -> list
    if (req.method === "GET" && pathname === "/api/blogs") {
      const status = (url.searchParams.get("status") ?? "published") as
        | "draft"
        | "in_review"
        | "published"
        | "archived";
      const categorySlug = url.searchParams.get("category") ?? undefined;
      const tagSlug = url.searchParams.get("tag") ?? undefined;
      const q = url.searchParams.get("q")?.trim() ?? "";
      const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
      const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("page_size") ?? 12)));

      // Resolve category id if slug provided
      let categoryId: string | undefined;
      if (categorySlug) {
        const { data: cat } = await supabase
          .from("blog_categories")
          .select("id, slug")
          .eq("slug", categorySlug)
          .maybeSingle();
        categoryId = cat?.id;
      }

      // Resolve tag id if slug provided
      let tagId: string | undefined;
      if (tagSlug) {
        const { data: tag } = await supabase
          .from("blog_tags")
          .select("id, slug")
          .eq("slug", tagSlug)
          .maybeSingle();
        tagId = tag?.id;
      }

      // Base query for posts
      let query = supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, cover_image_url, category_id, author_id, reading_minutes, published_at, status, view_count")
        .order("published_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (q) query = query.ilike("title", `%${q}%`);

      // Execute base to get candidate posts
      const { data: basePosts, error: baseErr } = await query;
      if (baseErr) throw baseErr;

      // Tag filter post-hoc if necessary
      let posts = basePosts ?? [];
      if (tagId) {
        const { data: tagLinks } = await supabase
          .from("blog_post_tags")
          .select("post_id")
          .eq("tag_id", tagId);
        const allowedIds = new Set((tagLinks ?? []).map((t) => t.post_id));
        posts = posts.filter((p) => allowedIds.has(p.id));
      }

      // Pagination
      const total = posts.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageItems = posts.slice(start, end);

      // Resolve authors and categories
      const authorIds = Array.from(new Set(pageItems.map((p) => p.author_id).filter(Boolean)));
      const categoryIds = Array.from(new Set(pageItems.map((p) => p.category_id).filter(Boolean)));

      const [{ data: authors }, { data: categories }] = await Promise.all([
        authorIds.length
          ? supabase
              .from("profiles")
              .select("user_id, full_name, avatar_url")
              .in("user_id", authorIds)
          : Promise.resolve({ data: [] as any[] } as any),
        categoryIds.length
          ? supabase
              .from("blog_categories")
              .select("id, title, slug")
              .in("id", categoryIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const authorMap = new Map((authors ?? []).map((a) => [a.user_id, a]));
      const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));

      // Reactions and comments counts
      const ids = pageItems.map((p) => p.id);
      const [reactionsRes, commentsRes] = await Promise.all([
        ids.length
          ? supabase.from("blog_reactions").select("post_id, reaction").in("post_id", ids)
          : Promise.resolve({ data: [] as any[] } as any),
        ids.length
          ? supabase.from("blog_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const likesCount = new Map<string, number>();
      for (const r of reactionsRes.data ?? []) {
        if (r.reaction === "thumbs_down") continue;
        likesCount.set(r.post_id, (likesCount.get(r.post_id) ?? 0) + 1);
      }
      const commentsCount = new Map<string, number>();
      for (const c of commentsRes.data ?? []) {
        commentsCount.set(c.post_id, (commentsCount.get(c.post_id) ?? 0) + 1);
      }

      const items = pageItems.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? null,
        cover_image_url: p.cover_image_url ?? null,
        category: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
        tags: [] as { slug: string; title: string }[],
        author: (() => {
          const a = authorMap.get(p.author_id);
          return a
            ? { id: p.author_id, name: a.full_name, avatar: a.avatar_url ?? null }
            : { id: p.author_id, name: "Unknown", avatar: null };
        })(),
        reading_minutes: p.reading_minutes ?? null,
        published_at: p.published_at ?? null,
        counts: {
          likes: likesCount.get(p.id) ?? 0,
          comments: commentsCount.get(p.id) ?? 0,
          views: p.view_count ?? 0,
        },
      }));

      // Load tags per post (batched)
      if (ids.length) {
        const { data: tagRows } = await supabase
          .from("blog_post_tags")
          .select("post_id, tag:blog_tags(slug, title)")
          .in("post_id", ids);
        const tagMap = new Map<string, { slug: string; title: string }[]>();
        for (const row of tagRows ?? []) {
          const arr = tagMap.get(row.post_id) ?? [];
          if (row.tag) arr.push(row.tag);
          tagMap.set(row.post_id, arr);
        }
        for (const item of items) item.tags = tagMap.get(item.id) ?? [];
      }

      return new Response(
        JSON.stringify({ items, page, page_size: pageSize, total }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GET /api/blogs/:slug -> details
    const slugMatch = pathname.match(/^\/api\/blogs\/([^\/]+)$/);
    if (req.method === "GET" && slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      const { data: post, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!post)
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      const [authorRes, reviewerRes, reactionsRes, commentsRes, summaryRes, tagsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", post.author_id).maybeSingle(),
        post.reviewer_id || post.reviewed_by
          ? supabase
              .from("profiles")
              .select("user_id, full_name, avatar_url")
              .eq("user_id", post.reviewer_id ?? post.reviewed_by)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("blog_reactions").select("reaction").eq("post_id", post.id),
        supabase.from("blog_comments").select("id, author_id, parent_id, content, created_at").eq("post_id", post.id).order("created_at", { ascending: true }),
        supabase.from("blog_ai_summaries").select("provider, model, summary_md, created_at").eq("post_id", post.id).maybeSingle(),
        supabase.from("blog_post_tags").select("tag:blog_tags(slug, title)").eq("post_id", post.id),
      ]);

      const reactions = new Map<string, number>();
      for (const r of reactionsRes.data ?? []) {
        reactions.set(r.reaction, (reactions.get(r.reaction) ?? 0) + 1);
      }

      // Build threaded comments (2-level)
      const comments = (commentsRes.data ?? []).map((c: any) => ({
        ...c,
        author: undefined as any,
        replies: [] as any[],
      }));
      const byId = new Map(comments.map((c) => [c.id, c]));
      const roots: any[] = [];
      for (const c of comments) {
        if (c.parent_id && byId.get(c.parent_id)) {
          byId.get(c.parent_id).replies.push(c);
        } else {
          roots.push(c);
        }
      }
      // attach authors minimal
      const commentAuthorIds = Array.from(new Set(comments.map((c) => c.author_id)));
      if (commentAuthorIds.length) {
        const { data: cAuthors } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", commentAuthorIds);
        const cmap = new Map((cAuthors ?? []).map((a) => [a.user_id, a]));
        for (const c of comments) c.author = cmap.get(c.author_id) ?? null;
      }

      const payload = {
        post: {
          ...post,
          author: authorRes.data
            ? { id: post.author_id, name: authorRes.data.full_name, avatar: authorRes.data.avatar_url ?? null }
            : { id: post.author_id, name: "Unknown", avatar: null },
          reviewer: reviewerRes.data
            ? { id: reviewerRes.data.user_id, name: reviewerRes.data.full_name, avatar: reviewerRes.data.avatar_url ?? null }
            : null,
          tags: (tagsRes.data ?? []).map((t: any) => t.tag).filter(Boolean),
        },
        reactions: Object.fromEntries(reactions),
        comments: roots,
        ai_summary: summaryRes.data ?? null,
      };

      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth guard helper
    const requireAuth = () => {
      if (!user) throw new Error("Unauthorized");
    };

    // POST /api/blogs -> create draft
    if (req.method === "POST" && pathname === "/api/blogs") {
      requireAuth();
      const body = await req.json();
      const parsed = createDraftSchema.parse(body);

      const baseSlug = slugify(parsed.title);
      let slug = baseSlug;
      // ensure unique slug
      for (let i = 1; i < 50; i++) {
        const { data: exists } = await supabase
          .from("blog_posts")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!exists) break;
        slug = `${baseSlug}-${i}`;
      }

      const insertRes = await supabase.from("blog_posts").insert({
        title: parsed.title,
        slug,
        excerpt: parsed.excerpt ?? null,
        cover_image_url: parsed.cover_image_url ?? null,
        content_md: parsed.content_md ?? null,
        content_html: parsed.content_html ?? null,
        reading_minutes: readingMinutesFrom({ md: parsed.content_md, html: parsed.content_html }),
        status: "draft",
        author_id: user!.id,
        category_id: parsed.category_id ?? null,
      }).select("id").maybeSingle();
      if (insertRes.error) throw insertRes.error;
      const postId = insertRes.data!.id as string;

      // Link existing tags by slug
      if (parsed.tag_slugs && parsed.tag_slugs.length) {
        const { data: tags } = await supabase
          .from("blog_tags")
          .select("id, slug")
          .in("slug", parsed.tag_slugs);
        const links = (tags ?? []).map((t) => ({ post_id: postId, tag_id: t.id }));
        if (links.length) await supabase.from("blog_post_tags").insert(links);
      }

      return new Response(JSON.stringify({ slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // POST /api/blogs/:id/submit
    const submitMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/submit$/i);
    if (req.method === "POST" && submitMatch) {
      requireAuth();
      const id = submitMatch[1];
      // Author only, move to in_review
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "in_review" })
        .eq("id", id)
        .eq("author_id", user!.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/review
    const reviewMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/review$/i);
    if (req.method === "POST" && reviewMatch) {
      requireAuth();
      const id = reviewMatch[1];
      const body = reviewSchema.parse(await req.json());
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      if (!isAdmin && !isGuru) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const patch: Record<string, any> = { reviewer_id: user!.id };
      if (typeof body.is_featured === "boolean") patch.is_featured = body.is_featured;
      if (typeof body.is_editors_pick === "boolean") patch.is_editors_pick = body.is_editors_pick;
      if (body.notes) patch.review_notes = body.notes;

      const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/publish
    const publishMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/publish$/i);
    if (req.method === "POST" && publishMatch) {
      requireAuth();
      const id = publishMatch[1];
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, content_md, content_html, reviewer_id, reviewed_by")
        .eq("id", id)
        .maybeSingle();
      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      const canReview = isAdmin || !!(post && (post.reviewer_id === user!.id || post.reviewed_by === user!.id));
      if (!canReview) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const minutes = readingMinutesFrom({ md: post?.content_md ?? undefined, html: post?.content_html ?? undefined });
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "published", reading_minutes: minutes, published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/react
    const reactMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/react$/i);
    if (req.method === "POST" && reactMatch) {
      requireAuth();
      const id = reactMatch[1];
      const { reaction } = reactSchema.parse(await req.json());

      // Toggle: if exists -> delete, else -> insert
      const { data: existing } = await supabase
        .from("blog_reactions")
        .select("post_id, user_id, reaction")
        .eq("post_id", id)
        .eq("user_id", user!.id)
        .eq("reaction", reaction)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("blog_reactions")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user!.id)
          .eq("reaction", reaction);
        if (error) throw error;
        return new Response(JSON.stringify({ toggled: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { error } = await supabase
          .from("blog_reactions")
          .insert({ post_id: id, user_id: user!.id, reaction });
        if (error) throw error;
        return new Response(JSON.stringify({ toggled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // POST /api/blogs/:id/comment
    const commentMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/comment$/i);
    if (req.method === "POST" && commentMatch) {
      requireAuth();
      const id = commentMatch[1];
      const { content, parent_id } = commentSchema.parse(await req.json());

      // Optional parent validation (same post)
      if (parent_id) {
        const { data: parent } = await supabase
          .from("blog_comments")
          .select("id, post_id")
          .eq("id", parent_id)
          .maybeSingle();
        if (!parent || parent.post_id !== id) {
          return new Response(JSON.stringify({ error: "Invalid parent_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { error } = await supabase
        .from("blog_comments")
        .insert({ post_id: id, author_id: user!.id, content, parent_id: parent_id ?? null });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/ai-summary
    const aiMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/ai-summary$/i);
    if (req.method === "POST" && aiMatch) {
      requireAuth();
      const id = aiMatch[1];
      const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
      const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
      if (!openAIApiKey) return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, title, content_md, content_html, reviewer_id, reviewed_by")
        .eq("id", id)
        .maybeSingle();
      if (!post) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      const canReview = isAdmin || post.reviewer_id === user!.id || post.reviewed_by === user!.id;
      if (!canReview) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const content = post.content_md ?? (post.content_html ? stripHtml(post.content_html) : "");
      const prompt = `Summarize the following blog post for EM clinicians in 5-7 bullet points with concise, high-yield takeaways.\n\nTitle: ${post.title}\n\nContent:\n${content.slice(0, 12000)}`;

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You summarize medical blog posts with precise, actionable bullet points." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content ?? "";

      // Upsert summary
      const { error } = await supabase
        .from("blog_ai_summaries")
        .upsert({ post_id: id, provider: "openai", model, summary_md: summary });
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, summary_md: summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin list: GET /api/blogs/admin?status=
    if (req.method === "GET" && pathname === "/api/blogs/admin") {
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { isAdmin } = await getUserRoleFlags(supabase, user.id);
      if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const status = (new URL(req.url).searchParams.get("status") ?? "in_review") as any;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, status, author_id, created_at, updated_at")
        .eq("status", status)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ items: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Docs
    if (req.method === "GET" && pathname === "/api/blogs/docs") {
      const docs = {
        base: "/functions/v1/blogs-api",
        endpoints: [
          { method: "GET", path: "/api/blogs", query: ["status", "category", "tag", "q", "page", "page_size"] },
          { method: "GET", path: "/api/blogs/:slug" },
          { method: "POST", path: "/api/blogs", body: createDraftSchema.shape },
          { method: "POST", path: "/api/blogs/:id/submit" },
          { method: "POST", path: "/api/blogs/:id/review", body: reviewSchema.shape },
          { method: "POST", path: "/api/blogs/:id/publish" },
          { method: "POST", path: "/api/blogs/:id/react", body: reactSchema.shape },
          { method: "POST", path: "/api/blogs/:id/comment", body: commentSchema.shape },
          { method: "POST", path: "/api/blogs/:id/ai-summary" },
          { method: "GET", path: "/api/blogs/admin?status=" },
        ],
      };
      return new Response(JSON.stringify(docs), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("blogs-api error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unexpected error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
