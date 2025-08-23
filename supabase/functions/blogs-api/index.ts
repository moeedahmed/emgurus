import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Dynamic CORS allowlist
function parseAllowlist(): string[] {
  const raw = Deno.env.get("ORIGIN_ALLOWLIST")?.split(",") || [];
  return raw.map((s) => s.trim()).filter(Boolean);
}
function isAllowedOrigin(origin: string): boolean {
  const list = parseAllowlist();
  if (!list.length) return false;
  if (list.includes("*")) return true;
  return !!origin && list.includes(origin);
}
function buildCors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  } as const;
}


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
  const origin = req.headers.get("Origin") ?? "";
  const allowed = isAllowedOrigin(origin);
  const corsHeaders = buildCors(origin);

  if (req.method === "OPTIONS") {
    if (!allowed) return new Response(JSON.stringify({ error: "Disallowed origin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(null, { headers: corsHeaders });
  }

  if (!allowed) {
    return new Response(JSON.stringify({ error: "Disallowed origin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabase = getClient(req);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    // Normalize path to work with both direct domain and function subpath
    const rawPath = url.pathname;
    let pathname = rawPath
      // strip common prefixes when calling via full URL or gateway
      .replace(/^\/functions\/v1\/blogs-api(?=\/$|$)/, "")
      .replace(/^\/blogs-api(?=\/$|$)/, "")
      .replace(/^\/+/, "/");
    // default root to list endpoint
    if (pathname === "/") pathname = "/api/blogs";

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
        .select("id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (q) query = query.ilike("title", `%${q}%`);

      // Execute base to get candidate posts
      const { data: basePosts, error: baseErr } = await query;
      if (baseErr) throw baseErr;

      // Tag filter - more efficient using inner join when tag is specified
      let posts = basePosts ?? [];
      if (tagId) {
        // Re-query with tag join for better performance on large datasets
        const taggedQuery = supabase
          .from("blog_posts")
          .select(`
            id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at,
            blog_post_tags!inner(tag_id)
          `)
          .eq("blog_post_tags.tag_id", tagId)
          .order("created_at", { ascending: false });

        if (status) taggedQuery.eq("status", status);
        if (categoryId) taggedQuery.eq("category_id", categoryId);
        if (q) taggedQuery.ilike("title", `%${q}%`);

        const { data: taggedPosts, error: taggedErr } = await taggedQuery;
        if (taggedErr) throw taggedErr;
        posts = taggedPosts ?? [];
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

      const items = pageItems.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.description ?? null,
        cover_image_url: p.cover_image_url ?? null,
        category: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
        tags: [] as { slug: string; title: string }[],
        author: (() => {
          const a = authorMap.get(p.author_id);
          return a
            ? { id: p.author_id, name: a.full_name, avatar: a.avatar_url ?? null }
            : { id: p.author_id, name: "Unknown", avatar: null };
        })(),
        reading_minutes: null,
        published_at: p.created_at ?? null,
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

    // POST /api/blogs/:id/feedback -> create feedback
    const feedbackMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/feedback$/i);
    if (req.method === "POST" && feedbackMatch) {
      requireAuth();
      const postId = feedbackMatch[1];
      const { message } = await req.json();
      
      if (!message || typeof message !== "string" || message.trim().length < 5) {
        return new Response(JSON.stringify({ error: "Message must be at least 5 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify post exists and is published
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, status")
        .eq("id", postId)
        .eq("status", "published")
        .maybeSingle();
      
      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found or not published" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: feedback, error } = await supabase
        .from("blog_post_feedback")
        .insert({
          post_id: postId,
          user_id: user!.id,
          message: message.trim(),
          status: "new",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Trigger notification for new feedback
      try {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("title, author_id, reviewer_id")
          .eq("id", postId)
          .single();
        
        if (postData) {
          // Notify admins and assigned gurus
          await supabase.functions.invoke("notifications-dispatch", {
            body: {
              toRole: "admin",
              category: "blogs",
              subject: `New feedback on blog: ${postData.title}`,
              html: `<h2>New feedback reported</h2><p>A user has reported an issue with the blog post: <strong>${postData.title}</strong></p><p>Feedback: ${message.trim()}</p>`,
              inApp: [{
                toRole: "admin",
                type: "blog_feedback",
                title: "New blog feedback",
                body: postData.title,
                data: { postId, postTitle: postData.title, feedbackId: feedback.id },
                category: "blogs",
              }],
            },
          });
          
          // Also notify assigned reviewer if any
          if (postData.reviewer_id) {
            await supabase.functions.invoke("notifications-dispatch", {
              body: {
                toUserIds: [postData.reviewer_id],
                category: "blogs",
                subject: `New feedback on blog: ${postData.title}`,
                html: `<h2>New feedback reported</h2><p>A user has reported an issue with the blog post you reviewed: <strong>${postData.title}</strong></p><p>Feedback: ${message.trim()}</p>`,
                inApp: [{
                  userId: postData.reviewer_id,
                  type: "blog_feedback",
                  title: "New blog feedback",
                  body: postData.title,
                  data: { postId, postTitle: postData.title, feedbackId: feedback.id },
                  category: "blogs",
                }],
              },
            });
          }
        }
      } catch (notifyError) {
        console.warn("Failed to send feedback notification:", notifyError);
      }

      return new Response(JSON.stringify({ id: feedback.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // GET /api/blogs/:id/feedback -> list feedback for post (admins/gurus only)
    const feedbackListMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/feedback$/i);
    if (req.method === "GET" && feedbackListMatch) {
      requireAuth();
      const postId = feedbackListMatch[1];
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      
      if (!isAdmin && !isGuru) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: feedback, error } = await supabase
        .from("blog_post_feedback")
        .select(`
          id,
          post_id,
          user_id,
          message,
          status,
          created_at,
          resolved_at,
          resolved_by,
          resolution_note,
          user:profiles(full_name)
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/blogs/feedback/:id/resolve -> resolve feedback (admins/gurus)
    const resolveMatch = pathname.match(/^\/api\/blogs\/feedback\/([0-9a-f-]{36})\/resolve$/i);
    if (req.method === "POST" && resolveMatch) {
      requireAuth();
      const feedbackId = resolveMatch[1];
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      
      if (!isAdmin && !isGuru) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { resolution_note } = await req.json();

      const { error } = await supabase
        .from("blog_post_feedback")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
          resolution_note: resolution_note || null,
        })
        .eq("id", feedbackId);

      if (error) throw error;

      // Trigger notification for feedback resolution
      try {
        const { data: feedbackData } = await supabase
          .from("blog_post_feedback")
          .select(`
            user_id,
            post:blog_posts(title)
          `)
          .eq("id", feedbackId)
          .single();
        
        if (feedbackData && feedbackData.user_id) {
          // Notify feedback author
          await supabase.functions.invoke("notifications-dispatch", {
            body: {
              toUserIds: [feedbackData.user_id],
              category: "blogs",
              subject: `Your blog feedback was resolved: ${feedbackData.post?.title}`,
              html: `<h2>Feedback resolved</h2><p>Your feedback on the blog post <strong>${feedbackData.post?.title}</strong> has been processed.</p>${resolution_note ? `<p>Resolution: ${resolution_note}</p>` : ''}`,
              inApp: [{
                userId: feedbackData.user_id,
                type: "blog_feedback_resolved",
                title: "Feedback resolved",
                body: feedbackData.post?.title || "Blog post",
                data: { feedbackId, postTitle: feedbackData.post?.title, status: "resolved" },
                category: "blogs",
              }],
            },
          });
        }
      } catch (notifyError) {
        console.warn("Failed to send feedback resolution notification:", notifyError);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/blogs -> create draft
    if (req.method === "POST" && pathname === "/api/blogs") {
      requireAuth();
      const body = await req.json();
      const parsed = createDraftSchema.parse(body);

      // Validate category exists before creating post
      if (parsed.category_id) {
        const { data: categoryExists } = await supabase
          .from("blog_categories")
          .select("id")
          .eq("id", parsed.category_id)
          .maybeSingle();
        if (!categoryExists) {
          return new Response(JSON.stringify({ error: "Invalid category ID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Validate tag slugs exist before creating post
      let validatedTags: { id: string; slug: string }[] = [];
      if (parsed.tag_slugs && parsed.tag_slugs.length) {
        const { data: tags } = await supabase
          .from("blog_tags")
          .select("id, slug")
          .in("slug", parsed.tag_slugs);
        
        // Validate all provided tag slugs exist
        const foundSlugs = new Set((tags ?? []).map((t) => t.slug));
        const invalidSlugs = parsed.tag_slugs.filter((slug) => !foundSlugs.has(slug));
        if (invalidSlugs.length > 0) {
          return new Response(JSON.stringify({ error: `Invalid tag slugs: ${invalidSlugs.join(", ")}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        validatedTags = tags ?? [];
      }

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
        description: parsed.excerpt ?? null,
        cover_image_url: parsed.cover_image_url ?? null,
        content: parsed.content_md ?? parsed.content_html ?? null,
        status: "draft",
        author_id: user!.id,
        category_id: parsed.category_id ?? null,
      }).select("id").maybeSingle();
      if (insertRes.error) throw insertRes.error;
      const postId = insertRes.data!.id as string;

      // Link validated tags
      if (validatedTags.length) {
        const links = validatedTags.map((t) => ({ post_id: postId, tag_id: t.id }));
        await supabase.from("blog_post_tags").insert(links);
      }

      return new Response(JSON.stringify({ id: postId, slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // PUT /api/blogs/:id -> update draft (author-only, draft status)
    const updateMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})$/i);
    if (req.method === "PUT" && updateMatch) {
      requireAuth();
      const id = updateMatch[1];
      const parsed = createDraftSchema.partial().parse(await req.json());

      // Author owns and status is draft
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, author_id, status")
        .eq("id", id)
        .maybeSingle();
      if (!post || post.author_id !== user!.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (post.status !== "draft") {
        return new Response(JSON.stringify({ error: "Only drafts can be updated" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Validate category exists before updating
      if (typeof parsed.category_id === "string") {
        const { data: categoryExists } = await supabase
          .from("blog_categories")
          .select("id")
          .eq("id", parsed.category_id)
          .maybeSingle();
        if (!categoryExists) {
          return new Response(JSON.stringify({ error: "Invalid category ID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Validate tag slugs exist before updating
      let validatedTags: { id: string; slug: string }[] = [];
      if (parsed.tag_slugs && parsed.tag_slugs.length) {
        const { data: tags } = await supabase
          .from("blog_tags")
          .select("id, slug")
          .in("slug", parsed.tag_slugs);
        
        // Validate all provided tag slugs exist
        const foundSlugs = new Set((tags ?? []).map((t: any) => t.slug));
        const invalidSlugs = parsed.tag_slugs.filter((slug: string) => !foundSlugs.has(slug));
        if (invalidSlugs.length > 0) {
          return new Response(JSON.stringify({ error: `Invalid tag slugs: ${invalidSlugs.join(", ")}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        validatedTags = tags ?? [];
      }

      const patch: Record<string, any> = {};
      if (typeof parsed.title === "string") patch.title = parsed.title;
      if (typeof parsed.excerpt === "string") patch.description = parsed.excerpt;
      if (typeof parsed.cover_image_url === "string") patch.cover_image_url = parsed.cover_image_url;
      if (typeof parsed.content_md === "string" || typeof parsed.content_html === "string") {
        patch.content = (parsed.content_md ?? parsed.content_html) ?? null;
      }
      if (typeof parsed.category_id === "string") patch.category_id = parsed.category_id;

      if (Object.keys(patch).length) {
        const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
        if (error) throw error;
      }

      if (parsed.tag_slugs !== undefined) {
        await supabase.from("blog_post_tags").delete().eq("post_id", id);
        if (validatedTags.length) {
          const links = validatedTags.map((t: any) => ({ post_id: id, tag_id: t.id }));
          await supabase.from("blog_post_tags").insert(links);
        }
      }

      return new Response(JSON.stringify({ ok: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/submit
    const submitMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/submit$/i);
    if (req.method === "POST" && submitMatch) {
      requireAuth();
      const id = submitMatch[1];
      // Author only, move to in_review
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "in_review", submitted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("author_id", user!.id);
      if (error) throw error;

      // Trigger notification for blog submission
      try {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("title")
          .eq("id", id)
          .single();
        
        if (postData) {
          // Notify admins about new submission
          await supabase.functions.invoke("notifications-dispatch", {
            body: {
              toRole: "admin",
              category: "blogs",
              subject: `New blog submitted: ${postData.title}`,
              html: `<h2>New blog submitted for review</h2><p>A new blog post has been submitted: <strong>${postData.title}</strong></p><p>Please review and assign a reviewer.</p>`,
              inApp: [{
                toRole: "admin",
                type: "blog_submitted",
                title: "New blog submitted",
                body: postData.title,
                data: { postId: id, postTitle: postData.title },
                category: "blogs",
              }],
            },
          });
        }
      } catch (notifyError) {
        console.warn("Failed to send submission notification:", notifyError);
      }

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

      // Trigger notification for blog assignment if reviewer was assigned
      if (patch.reviewer_id) {
        try {
          const { data: postData } = await supabase
            .from("blog_posts")
            .select("title, author_id")
            .eq("id", id)
            .single();
          
          if (postData) {
            // Notify assigned reviewer
            await supabase.functions.invoke("notifications-dispatch", {
              body: {
                toUserIds: [patch.reviewer_id],
                category: "blogs",
                subject: `New blog assigned for review: ${postData.title}`,
                html: `<h2>Blog assigned for review</h2><p>You have been assigned to review the blog post: <strong>${postData.title}</strong></p>`,
                inApp: [{
                  userId: patch.reviewer_id,
                  type: "blog_assigned",
                  title: "Blog assigned for review",
                  body: postData.title,
                  data: { postId: id, postTitle: postData.title },
                  category: "blogs",
                }],
              },
            });
          }
        } catch (notifyError) {
          console.warn("Failed to send assignment notification:", notifyError);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/request-changes
    const requestChangesMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/request-changes$/i);
    if (req.method === "POST" && requestChangesMatch) {
      requireAuth();
      const id = requestChangesMatch[1];
      const { note } = await req.json();
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      if (!isAdmin && !isGuru) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { error } = await supabase.rpc('review_request_changes', { p_post_id: id, p_note: note });
      if (error) throw error;

      // Trigger notification for change request
      try {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("title, author_id")
          .eq("id", id)
          .single();
        
        if (postData && postData.author_id) {
          await supabase.from("notifications").insert({
            user_id: postData.author_id,
            type: "blog_changes_requested",
            title: "Changes requested for your blog",
            body: `Your blog "${postData.title}" needs revisions.`,
            data: { post_id: id, title: postData.title, note },
          });
        }
      } catch (notifyError) {
        console.warn("Failed to send change request notification:", notifyError);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/reject
    const rejectMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/reject$/i);
    if (req.method === "POST" && rejectMatch) {
      requireAuth();
      const id = rejectMatch[1];
      const { note } = await req.json();
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      if (!isAdmin && !isGuru) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "archived", review_notes: note, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Trigger notification for rejection
      try {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("title, author_id")
          .eq("id", id)
          .single();
        
        if (postData && postData.author_id) {
          await supabase.from("notifications").insert({
            user_id: postData.author_id,
            type: "blog_rejected",
            title: "Blog submission rejected",
            body: `Your blog "${postData.title}" was not approved for publication.`,
            data: { post_id: id, title: postData.title, note },
          });
        }
      } catch (notifyError) {
        console.warn("Failed to send rejection notification:", notifyError);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/publish
    const publishMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/publish$/i);
    if (req.method === "POST" && publishMatch) {
      requireAuth();
      const id = publishMatch[1];
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, reviewer_id, reviewed_by")
        .eq("id", id)
        .maybeSingle();
      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      const canReview = isAdmin || !!(post && (post.reviewer_id === user!.id || post.reviewed_by === user!.id));
      if (!canReview) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "published", reviewed_at: nowIso, reviewed_by: user!.id, published_at: nowIso })
        .eq("id", id);
      if (error) throw error;

      // Trigger notification for blog publication
      try {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("title, author_id")
          .eq("id", id)
          .single();
        
        if (postData && postData.author_id) {
          // Notify author about publication
          await supabase.functions.invoke("notifications-dispatch", {
            body: {
              toUserIds: [postData.author_id],
              category: "blogs",
              subject: `Your blog has been published: ${postData.title}`,
              html: `<h2>Blog published!</h2><p>Congratulations! Your blog post <strong>${postData.title}</strong> has been published and is now live.</p>`,
              inApp: [{
                userId: postData.author_id,
                type: "blog_published",
                title: "Your blog was published",
                body: postData.title,
                data: { postId: id, postTitle: postData.title },
                category: "blogs",
              }],
            },
          });
        }
      } catch (notifyError) {
        console.warn("Failed to send publication notification:", notifyError);
      }

      // Try to auto-generate AI summary (non-blocking)
      try {
        const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
        const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
        if (openAIApiKey) {
          const { data: post2 } = await supabase
            .from("blog_posts")
            .select("id, title, content")
            .eq("id", id)
            .maybeSingle();
          const content = post2?.content ? stripHtml(post2.content) : "";
          if ((post2?.title || content)) {
            const prompt = `Summarize the following blog post for EM clinicians in 5-7 bullet points with concise, high-yield takeaways.\n\nTitle: ${post2?.title ?? ""}\n\nContent:\n${content.slice(0, 12000)}`;
            const resp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: "You summarize medical blog posts with precise, actionable bullet points." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.2,
              }),
            });
            const d = await resp.json();
            const summary = d.choices?.[0]?.message?.content ?? "";
            if (summary) {
              await supabase.from("blog_ai_summaries").upsert({ post_id: id, provider: "openai", model, summary_md: summary });
            }
          }
        }
      } catch (e) {
        console.error("Auto summary failed", e);
      }

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
        .select("id, title, content, reviewer_id, reviewed_by")
        .eq("id", id)
        .maybeSingle();
      if (!post) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      const canReview = isAdmin || post.reviewer_id === user!.id || post.reviewed_by === user!.id;
      if (!canReview) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const content = post.content ? stripHtml(post.content) : "";
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

    // GET /api/blogs/:id/discussions -> fetch discussions for a post
    const discussionsMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/discussions$/i);
    if (req.method === "GET" && discussionsMatch) {
      const postId = discussionsMatch[1];
      
      // Check if user can access this post
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, author_id, reviewer_id, reviewed_by, status")
        .eq("id", postId)
        .maybeSingle();
      
      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: discussions, error } = await supabase
        .from("blog_post_discussions")
        .select(`
          id,
          post_id,
          author_id,
          message,
          kind,
          created_at,
          author:profiles(user_id, full_name)
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const items = (discussions ?? []).map((d: any) => ({
        id: d.id,
        post_id: d.post_id,
        author_id: d.author_id,
        message: d.message,
        kind: d.kind,
        created_at: d.created_at,
        author_name: d.author?.full_name || "Unknown",
      }));

      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/blogs/:id/discussions -> create new discussion message
    if (req.method === "POST" && discussionsMatch) {
      const postId = discussionsMatch[1];
      const { message, kind = "comment" } = await req.json();

      if (!message?.trim()) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("blog_post_discussions")
        .insert({
          post_id: postId,
          author_id: user.id,
          message: message.trim(),
          kind,
        });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // DELETE /api/blogs/discussions/:id -> delete discussion message
    const deleteDiscussionMatch = pathname.match(/^\/api\/blogs\/discussions\/([0-9a-f-]{36})$/i);
    if (req.method === "DELETE" && deleteDiscussionMatch) {
      const discussionId = deleteDiscussionMatch[1];

      const { error } = await supabase
        .from("blog_post_discussions")
        .delete()
        .eq("id", discussionId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /api/user/feedback -> get current user's feedback
    if (req.method === "GET" && pathname === "/api/user/feedback") {
      requireAuth();
      
      const { data: feedback, error } = await supabase
        .from("blog_post_feedback")
        .select(`
          id,
          message,
          status,
          resolution_note,
          created_at,
          resolved_at,
          post:blog_posts!inner(title, slug)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ items: feedback || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /api/admin/feedback -> get unresolved feedback for admins/gurus
    if (req.method === "GET" && pathname === "/api/admin/feedback") {
      requireAuth();
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      
      if (!isAdmin && !isGuru) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: feedback, error } = await supabase
        .from("blog_post_feedback")
        .select(`
          id,
          message,
          status,
          resolution_note,
          created_at,
          resolved_at,
          user:profiles!blog_post_feedback_user_id_fkey(full_name),
          post:blog_posts!inner(title, slug)
        `)
        .eq("status", "new")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ items: feedback || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          { method: "POST", path: "/api/blogs/:id/request-changes" },
          { method: "POST", path: "/api/blogs/:id/reject" },
          { method: "POST", path: "/api/blogs/:id/publish" },
          { method: "POST", path: "/api/blogs/:id/react", body: reactSchema.shape },
          { method: "POST", path: "/api/blogs/:id/comment", body: commentSchema.shape },
          { method: "POST", path: "/api/blogs/:id/ai-summary" },
          { method: "GET", path: "/api/blogs/admin?status=" },
          { method: "GET", path: "/api/user/feedback" },
          { method: "GET", path: "/api/admin/feedback" },
          { method: "POST", path: "/api/blogs/feedback/:id/resolve" },
          { method: "GET", path: "/api/blogs/:id/discussions" },
          { method: "POST", path: "/api/blogs/:id/discussions" },
          { method: "DELETE", path: "/api/blogs/discussions/:id" },
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
