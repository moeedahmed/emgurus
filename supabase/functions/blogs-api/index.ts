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

function generateAutoSummary(content: string): string {
  const text = stripHtml(content);
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  
  // Take first 2-3 sentences or up to 150 words
  let summary = "";
  let wordCount = 0;
  
  for (const sentence of sentences.slice(0, 3)) {
    const words = sentence.trim().split(/\s+/).length;
    if (wordCount + words > 150) break;
    summary += sentence.trim() + ". ";
    wordCount += words;
  }
  
  return summary.trim() || "Auto-generated summary not available.";
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
      const featured = url.searchParams.get("featured") === "true";
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
        .select("id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at, is_featured")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (q) query = query.ilike("title", `%${q}%`);
      if (featured) query = query.eq("is_featured", true);
      if (featured) query = query.eq("is_featured", true);

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
            id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at, is_featured,
            blog_post_tags!inner(tag_id)
          `)
          .eq("blog_post_tags.tag_id", tagId)
          .order("created_at", { ascending: false });

        if (status) taggedQuery.eq("status", status);
        if (categoryId) taggedQuery.eq("category_id", categoryId);
        if (q) taggedQuery.ilike("title", `%${q}%`);
        if (featured) taggedQuery.eq("is_featured", true);
        if (featured) taggedQuery.eq("is_featured", true);

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

      // Reactions, comments, shares, and feedback counts
      const ids = pageItems.map((p) => p.id);
      const [reactionsRes, commentsRes, sharesRes, feedbackRes] = await Promise.all([
        ids.length
          ? supabase.from("blog_reactions").select("post_id, reaction").in("post_id", ids)
          : Promise.resolve({ data: [] as any[] } as any),
        ids.length
          ? supabase.from("blog_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as any[] } as any),
        ids.length
          ? supabase.from("blog_shares").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as any[] } as any),
        ids.length
          ? supabase.from("blog_post_feedback").select("post_id").in("post_id", ids)
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
      const sharesCount = new Map<string, number>();
      for (const s of sharesRes.data ?? []) {
        sharesCount.set(s.post_id, (sharesCount.get(s.post_id) ?? 0) + 1);
      }
      const feedbackCount = new Map<string, number>();
      for (const f of feedbackRes.data ?? []) {
        feedbackCount.set(f.post_id, (feedbackCount.get(f.post_id) ?? 0) + 1);
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
          shares: sharesCount.get(p.id) ?? 0,
          feedback: feedbackCount.get(p.id) ?? 0,
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

      const [authorRes, assignmentsRes, reactionsRes, commentsRes, summaryRes, tagsRes, sharesRes, feedbackRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", post.author_id).maybeSingle(),
        // Get assigned reviewers from blog_review_assignments
        supabase
          .from("blog_review_assignments")
          .select(`
            reviewer_id,
            status,
            profiles!blog_review_assignments_reviewer_id_fkey(user_id, full_name, avatar_url)
          `)
          .eq("post_id", post.id)
          .eq("status", "pending"),
        supabase.from("blog_reactions").select("reaction").eq("post_id", post.id),
        supabase.from("blog_comments").select("id, author_id, parent_id, content, created_at").eq("post_id", post.id).order("created_at", { ascending: true }),
        supabase.from("blog_ai_summaries").select("provider, model, summary_md, created_at").eq("post_id", post.id).maybeSingle(),
        supabase.from("blog_post_tags").select("tag:blog_tags(slug, title)").eq("post_id", post.id),
        supabase.from("blog_shares").select("id").eq("post_id", post.id),
        supabase.from("blog_post_feedback").select("id").eq("post_id", post.id),
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

      // Process reviewers from assignments
      const reviewers = (assignmentsRes.data || []).map((a: any) => ({
        id: a.reviewer_id,
        name: a.profiles?.full_name || 'Unknown',
        avatar: a.profiles?.avatar_url || null
      }));

      // Generate AI summary if missing
      let aiSummary = summaryRes.data;
      if (!aiSummary && post.content) {
        try {
          const summaryContent = generateAutoSummary(post.content);
          const { data: newSummary } = await supabase
            .from("blog_ai_summaries")
            .insert({
              post_id: post.id,
              provider: "auto",
              model: "auto-generated",
              summary_md: summaryContent,
            })
            .select()
            .single();
          aiSummary = newSummary;
        } catch (error) {
          console.error("Failed to generate AI summary:", error);
        }
      }

      // Build engagement object
      const engagement = {
        views: post.view_count ?? 0,
        likes: reactions.get("thumbs_up") ?? 0,
        comments: roots.length + roots.reduce((acc: number, c: any) => acc + (c.replies?.length ?? 0), 0),
        shares: (sharesRes.data ?? []).length,
        feedback: (feedbackRes.data ?? []).length
      };

      const payload = {
        post: {
          ...post,
          author: authorRes.data
            ? { id: post.author_id, name: authorRes.data.full_name, avatar: authorRes.data.avatar_url ?? null }
            : { id: post.author_id, name: "Unknown", avatar: null },
          reviewers: reviewers.length > 0 ? reviewers : null,
          tags: (tagsRes.data ?? []).map((t: any) => t.tag).filter(Boolean),
        },
        reactions: Object.fromEntries(reactions),
        comments: roots,
        ai_summary: aiSummary ?? null,
        engagement,
      };

      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth guard helper
    const requireAuth = () => {
      if (!user) throw new Error("Unauthorized");
      return user;
    };

    // POST /api/blogs (create draft)
    if (req.method === "POST" && pathname === "/api/blogs") {
      requireAuth();
      const body = await req.json();
      
      // Handle different actions
      if (body.action === "create_draft") {
        const parsed = createDraftSchema.parse(body);
        
        // Validation
        const errors: { field: string; message: string }[] = [];
        if (!parsed.title?.trim()) {
          errors.push({ field: "title", message: "Title is required" });
        }
        if (parsed.title && parsed.title.length < 3) {
          errors.push({ field: "title", message: "Title must be at least 3 characters" });
        }
        if (!body.content?.trim()) {
          errors.push({ field: "content", message: "Content is required" });
        }
        if (!body.tags || body.tags.length === 0) {
          errors.push({ field: "tags", message: "At least one tag is required" });
        }
        
        if (errors.length > 0) {
          return new Response(JSON.stringify({ success: false, errors }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await supabase.rpc("create_blog_draft", {
          p_title: parsed.title,
          p_content_md: body.content,
          p_category_id: parsed.category_id || null,
          p_tags: body.tags || [],
        });

        if (result.error) throw result.error;

        return new Response(JSON.stringify({ success: true, post: result.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "assign_reviewer") {
        if (!body.post_id || !body.reviewer_id) {
          return new Response(JSON.stringify({ 
            success: false, 
            errors: [{ field: "reviewer_id", message: "Post ID and reviewer ID are required" }] 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Insert assignment
        const { error: assignError } = await supabase
          .from("blog_review_assignments")
          .insert({
            post_id: body.post_id,
            reviewer_id: body.reviewer_id,
            assigned_by: user.id,
            status: "pending",
          });

        if (assignError) throw assignError;

        // Update post status
        const { error: updateError } = await supabase
          .from("blog_posts")
          .update({ 
            status: "in_review",
            assigned_by: user.id,
            assigned_at: new Date().toISOString()
          })
          .eq("id", body.post_id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "assign_reviewers") {
        if (!body.post_id || !body.reviewer_ids || !Array.isArray(body.reviewer_ids) || body.reviewer_ids.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            errors: [{ field: "reviewer_ids", message: "Post ID and at least one reviewer ID are required" }] 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if user can assign reviewers (admin only for now)
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        const userRoles = (roles || []).map(r => r.role);
        if (!userRoles.includes('admin')) {
          return new Response(JSON.stringify({ 
            success: false, 
            errors: [{ field: "authorization", message: "Admin role required to assign reviewers" }] 
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Create assignment records for each reviewer
        const assignments = body.reviewer_ids.map((reviewer_id: string) => ({
          post_id: body.post_id,
          reviewer_id,
          assigned_by: user.id,
          status: 'pending' as const,
          assigned_at: new Date().toISOString(),
          notes: body.note || 'Assigned via Blog Generator'
        }));

        const { data: assignmentData, error: assignError } = await supabase
          .from("blog_review_assignments")
          .insert(assignments)
          .select("*");

        if (assignError) {
          console.error("Assignment error:", assignError);
          return new Response(JSON.stringify({ 
            success: false, 
            errors: [{ field: "assignment", message: "Failed to create reviewer assignments" }] 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Update post status
        const { error: updateError } = await supabase
          .from("blog_posts")
          .update({
            status: 'in_review',
            submitted_at: new Date().toISOString(),
            assigned_by: user.id,
            assigned_at: new Date().toISOString()
          })
          .eq('id', body.post_id);

        if (updateError) {
          console.error("Update error:", updateError);
          return new Response(JSON.stringify({ 
            success: false, 
            errors: [{ field: "update", message: "Failed to update post status" }] 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true, assignments: assignmentData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Generate blog draft
      const parsed = createDraftSchema.partial().parse(body);
      
      if (!body.topic?.trim()) {
        return new Response(JSON.stringify({ 
          success: false, 
          errors: [{ field: "topic", message: "Topic is required for generation" }] 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate content based on parameters
      let generatedContent = `# ${body.topic}\n\nThis is a generated blog post about ${body.topic}.`;
      
      // Process files and URLs with error tracking
      const sourceErrors: Array<{ source: string; error: string }> = [];
      
      if (body.files && body.files.length > 0) {
        generatedContent += "\n\n## Referenced Content\n\n";
        for (const file of body.files) {
          try {
            if (!file.content || file.content.trim().length === 0) {
              sourceErrors.push({ source: file.name, error: "File content is empty or invalid" });
              continue;
            }
            // Basic content validation
            if (file.content.length < 10) {
              sourceErrors.push({ source: file.name, error: "File content too short to be useful" });
              continue;
            }
            generatedContent += `### From ${file.name}\n\n${file.content.substring(0, 500)}...\n\n`;
          } catch (err) {
            sourceErrors.push({ source: file.name, error: `Failed to process file: ${err}` });
          }
        }
      }

      if (body.urls && body.urls.length > 0) {
        generatedContent += "\n\n## Referenced URLs\n\n";
        for (const url of body.urls) {
          try {
            if (!url.trim()) continue;
            
            // Basic URL validation
            if (!url.match(/^https?:\/\/.+/)) {
              sourceErrors.push({ source: url, error: "Invalid URL format - must start with http:// or https://" });
              continue;
            }
            
            // Try to fetch content if searchOnline is enabled
            if (body.searchOnline) {
              try {
                const response = await fetch(url, { 
                  signal: AbortSignal.timeout(5000) // 5 second timeout
                });
                if (!response.ok) {
                  sourceErrors.push({ source: url, error: `Failed to fetch: ${response.status} ${response.statusText}` });
                  continue;
                }
                const text = await response.text();
                const cleanText = text
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                  .replace(/<[^>]*>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (cleanText.length > 50) {
                  generatedContent += `### From ${url}\n\n${cleanText.substring(0, 800)}...\n\n`;
                } else {
                  sourceErrors.push({ source: url, error: "URL content too short or empty" });
                }
              } catch (fetchErr) {
                sourceErrors.push({ source: url, error: `Failed to scrape URL: ${fetchErr}` });
              }
            } else {
              generatedContent += `- ${url}\n`;
            }
          } catch (err) {
            sourceErrors.push({ source: url, error: `Failed to process URL: ${err}` });
          }
        }
      }

      // Apply tone and length adjustments
      if (body.tone === "academic") {
        generatedContent += "\n\nThis analysis demonstrates the significance of the aforementioned concepts.";
      } else if (body.tone === "casual") {
        generatedContent += "\n\nHope this helps clarify things!";
      }

      // Validate generated content
      const contentErrors: Array<{ field: string; message: string }> = [];
      
      if (!body.topic?.trim()) {
        contentErrors.push({ field: "topic", message: "Topic is required" });
      }
      
      if (generatedContent.length < 100) {
        contentErrors.push({ field: "content", message: "Generated content is too short" });
      }

      // Return errors if any validation failed
      if (contentErrors.length > 0 || sourceErrors.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          errors: contentErrors,
          sourceErrors: sourceErrors
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = {
        success: true,
        draft: {
          title: body.topic,
          content: generatedContent,
          tags: [body.topic.toLowerCase().replace(/\s+/g, "-")],
          excerpt: `A comprehensive guide to ${body.topic}`,
        },
        sourceErrors: sourceErrors.length > 0 ? sourceErrors : undefined
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
          .select("title, author_id")
          .eq("id", postId)
          .single();
        
        if (postData) {
          // Get all active reviewers for notifications
          const { data: assignments } = await supabase
            .from('blog_review_assignments')
            .select('reviewer_id')
            .eq('post_id', postId)
            .eq('status', 'pending');

          const reviewerIds = (assignments || []).map((a: any) => a.reviewer_id);
          
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
          
          // Notify all active reviewers
          for (const reviewerId of reviewerIds) {
            await supabase.functions.invoke("notifications-dispatch", {
              body: {
                toUserIds: [reviewerId],
                category: "blogs",
                subject: `New feedback on blog: ${postData.title}`,
                html: `<h2>New feedback reported</h2><p>A user has reported an issue with the blog post you're reviewing: <strong>${postData.title}</strong></p><p>Feedback: ${message.trim()}</p>`,
                inApp: [{
                  userId: reviewerId,
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

    // GET /api/blogs/:id/comments -> list comments
    const commentsListMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/comments$/i);
    if (req.method === "GET" && commentsListMatch) {
      const postId = commentsListMatch[1];
      const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
      const pageSize = Math.min(20, Math.max(1, Number(url.searchParams.get("page_size") ?? 10)));

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

      // Get all comments for this post
      const { data: allComments, error: commentsErr } = await supabase
        .from("blog_comments")
        .select("id, author_id, parent_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsErr) throw commentsErr;

      // Get comment authors
      const authorIds = Array.from(new Set((allComments || []).map(c => c.author_id)));
      const { data: authors } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", authorIds);
      const authorMap = new Map((authors || []).map(a => [a.user_id, a]));

      // Get comment reactions
      const commentIds = (allComments || []).map(c => c.id);
      const { data: reactions } = await supabase
        .from("blog_comment_reactions")
        .select("comment_id, user_id, reaction")
        .in("comment_id", commentIds);

      // Build reaction counts and user reactions
      const reactionCounts = new Map<string, { up: number; down: number }>();
      const userReactions = new Map<string, string>();
      
      for (const r of reactions || []) {
        const key = r.comment_id;
        const counts = reactionCounts.get(key) || { up: 0, down: 0 };
        if (r.reaction === "up") counts.up++;
        else if (r.reaction === "down") counts.down++;
        reactionCounts.set(key, counts);

        if (user && r.user_id === user.id) {
          userReactions.set(key, r.reaction);
        }
      }

      // Build threaded structure
      const comments = (allComments || []).map(c => ({
        ...c,
        author: authorMap.get(c.author_id) || null,
        reactions: reactionCounts.get(c.id) || { up: 0, down: 0 },
        user_reaction: userReactions.get(c.id) || null,
        replies: [] as any[]
      }));

      const commentMap = new Map(comments.map(c => [c.id, c]));
      const rootComments = [];

      for (const comment of comments) {
        if (comment.parent_id && commentMap.has(comment.parent_id)) {
          commentMap.get(comment.parent_id)!.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      }

      // Paginate root comments only
      const total = rootComments.length;
      const start = (page - 1) * pageSize;
      const pageComments = rootComments.slice(start, start + pageSize);

      return new Response(JSON.stringify({
        comments: pageComments,
        total,
        page,
        page_size: pageSize
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/blogs/:id/comment -> create comment
    const commentMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/comment$/i);
    if (req.method === "POST" && commentMatch) {
      requireAuth();
      const postId = commentMatch[1];
      const body = commentSchema.parse(await req.json());
      
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

      // Check if this is a reply and limit depth
      if (body.parent_id) {
        const { data: parent } = await supabase
          .from("blog_comments")
          .select("parent_id")
          .eq("id", body.parent_id)
          .maybeSingle();
        
        if (!parent) {
          return new Response(JSON.stringify({ error: "Parent comment not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Limit to 2 levels - can't reply to a reply
        if (parent.parent_id) {
          return new Response(JSON.stringify({ error: "Maximum comment depth reached" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: comment, error } = await supabase
        .from("blog_comments")
        .insert({
          post_id: postId,
          author_id: user!.id,
          content: body.content.trim(),
          parent_id: body.parent_id || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, comment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /api/blogs/comments/:id -> delete comment
    const deleteCommentMatch = pathname.match(/^\/api\/blogs\/comments\/([0-9a-f-]{36})$/i);
    if (req.method === "DELETE" && deleteCommentMatch) {
      requireAuth();
      const commentId = deleteCommentMatch[1];
      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);

      const { data: comment } = await supabase
        .from("blog_comments")
        .select("author_id")
        .eq("id", commentId)
        .maybeSingle();

      if (!comment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only author or admin can delete
      if (comment.author_id !== user!.id && !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("blog_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/blogs/comments/:id/react -> toggle reaction
    const reactCommentMatch = pathname.match(/^\/api\/blogs\/comments\/([0-9a-f-]{36})\/react$/i);
    if (req.method === "POST" && reactCommentMatch) {
      requireAuth();
      const commentId = reactCommentMatch[1];
      const { type, feedback } = await req.json();

      if (!["up", "down"].includes(type)) {
        return new Response(JSON.stringify({ error: "Invalid reaction type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify comment exists
      const { data: comment } = await supabase
        .from("blog_comments")
        .select("post_id")
        .eq("id", commentId)
        .maybeSingle();

      if (!comment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check existing reaction
      const { data: existingReaction } = await supabase
        .from("blog_comment_reactions")
        .select("reaction")
        .eq("comment_id", commentId)
        .eq("user_id", user!.id)
        .maybeSingle();

      let toggled = false;

      if (existingReaction) {
        if (existingReaction.reaction === type) {
          // Remove reaction if same type
          await supabase
            .from("blog_comment_reactions")
            .delete()
            .eq("comment_id", commentId)
            .eq("user_id", user!.id);
          toggled = false;
        } else {
          // Update reaction if different type
          await supabase
            .from("blog_comment_reactions")
            .update({ reaction: type })
            .eq("comment_id", commentId)
            .eq("user_id", user!.id);
          toggled = true;
        }
      } else {
        // Create new reaction
        await supabase
          .from("blog_comment_reactions")
          .insert({
            comment_id: commentId,
            user_id: user!.id,
            reaction: type
          });
        toggled = true;
      }

      // If thumbs down and feedback provided, create feedback entry
      if (type === "down" && toggled && feedback?.trim()) {
        await supabase
          .from("blog_post_feedback")
          .insert({
            post_id: comment.post_id,
            user_id: user!.id,
            message: feedback.trim(),
            status: "new"
          });
      }

      return new Response(JSON.stringify({ success: true, toggled }), {
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

    // POST /api/blogs/:id/assign -> assign reviewer(s)
    const assignMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/assign$/i);
    if (req.method === "POST" && assignMatch) {
      requireAuth();
      const id = assignMatch[1];
      const { reviewer_id, note } = await req.json();
      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Verify reviewer is a guru
      const { data: isReviewerGuru } = await supabase.rpc("has_role", { _user_id: reviewer_id, _role: "guru" });
      if (!isReviewerGuru) {
        return new Response(JSON.stringify({ error: "Reviewer must be a guru" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // Insert assignment
      const { error } = await supabase
        .from("blog_review_assignments")
        .insert({
          post_id: id,
          reviewer_id,
          assigned_by: user!.id,
          notes: note || null,
          status: "pending"
        });

      if (error) throw error;

      // Trigger notification for blog assignment
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
              toUserIds: [reviewer_id],
              category: "blogs",
              subject: `New blog assigned for review: ${postData.title}`,
              html: `<h2>Blog assigned for review</h2><p>You have been assigned to review the blog post: <strong>${postData.title}</strong></p>${note ? `<p>Note: ${note}</p>` : ''}`,
              inApp: [{
                userId: reviewer_id,
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

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/blogs/:id/review -> guru review actions
    const reviewMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/review$/i);
    if (req.method === "POST" && reviewMatch) {
      requireAuth();
      const id = reviewMatch[1];
      const body = reviewSchema.parse(await req.json());
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user!.id);
      if (!isAdmin && !isGuru) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Update assignment status to completed
      const { error: assignmentError } = await supabase
        .from("blog_review_assignments")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("post_id", id)
        .eq("reviewer_id", user!.id)
        .eq("status", "pending");

      if (assignmentError) console.warn("Failed to update assignment:", assignmentError);

      const patch: Record<string, any> = { reviewed_by: user!.id, reviewed_at: new Date().toISOString() };
      if (typeof body.is_featured === "boolean") patch.is_featured = body.is_featured;
      if (typeof body.is_editors_pick === "boolean") patch.is_editors_pick = body.is_editors_pick;
      if (body.notes) patch.review_notes = body.notes;

      const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
      if (error) throw error;

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

      // Update assignment status if this is from assigned reviewer
      if (isGuru) {
        const { error: assignmentError } = await supabase
          .from("blog_review_assignments")
          .update({ status: "changes_requested", updated_at: new Date().toISOString() })
          .eq("post_id", id)
          .eq("reviewer_id", user!.id)
          .eq("status", "pending");

        if (assignmentError) console.warn("Failed to update assignment:", assignmentError);
      }

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

      // Update assignment status if this is from assigned reviewer
      if (isGuru) {
        const { error: assignmentError } = await supabase
          .from("blog_review_assignments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("post_id", id)
          .eq("reviewer_id", user!.id)
          .eq("status", "pending");

        if (assignmentError) console.warn("Failed to update assignment:", assignmentError);
      }

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
        .select("id, reviewed_by, author_id, title")
        .eq("id", id)
        .maybeSingle();
      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      
      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Enforce reviewer assignment requirement for ALL roles including admins
      const { data: assignments, error: assignmentsErr } = await supabase
        .from("blog_review_assignments")
        .select("id, reviewer_id, status")
        .eq("post_id", id)
        .eq("status", "completed");

      if (assignmentsErr) throw assignmentsErr;

      if (!assignments || assignments.length === 0) {
        return new Response(JSON.stringify({ 
          error: "Cannot publish: A reviewer must be assigned and approve the post before publishing." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check if user can publish (admin or has assignment)
      let canReview = isAdmin || !!(post && post.reviewed_by === user!.id);
      if (!canReview && !isAdmin) {
        const { data: assignment } = await supabase
          .from("blog_review_assignments")
          .select("id")
          .eq("post_id", id)
          .eq("reviewer_id", user!.id)
          .maybeSingle();
        canReview = !!assignment;
      }
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

async function trackShare(postId: string, req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  try {
    const { platform } = await req.json();

    if (!platform) {
      return new Response(JSON.stringify({ error: 'Platform is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user ID for authenticated tracking (optional)
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch (error) {
        // Continue without user ID for anonymous shares
      }
    }

    // Check if blog post exists
    const { data: post, error: postError } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('id', postId)
      .eq('status', 'published')
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record the share
    const { error: shareError } = await supabase
      .from('blog_shares')
      .insert({
        post_id: postId,
        user_id: userId,
        platform: platform,
        shared_at: new Date().toISOString(),
      });

    if (shareError) {
      console.error('Error recording share:', shareError);
      return new Response(JSON.stringify({ error: 'Failed to record share' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get updated share count
    const { data: shares } = await supabase
      .from('blog_shares')
      .select('id')
      .eq('post_id', postId);

    const shareCount = shares?.length || 0;

    return new Response(JSON.stringify({ 
      success: true,
      share_count: shareCount,
      platform 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in trackShare:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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

    // POST /api/blogs/:id/comment (duplicate handler)
    const commentMatch2 = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/comment$/i);
    if (req.method === "POST" && commentMatch2) {
      requireAuth();
      const id = commentMatch2[1];
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

    // POST /api/blogs/:id/share
    const shareMatch = pathname.match(/^\/api\/blogs\/([0-9a-f-]{36})\/share$/i);
    if (req.method === "POST" && shareMatch) {
      const id = shareMatch[1];
      const body = await req.json();
      const { platform } = body;

      if (!platform) {
        return new Response(JSON.stringify({ error: 'Platform is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user ID for authenticated tracking (optional)
      let userId = null;
      try {
        if (user) userId = user.id;
      } catch (error) {
        // Continue without user ID for anonymous shares
      }

      // Check if blog post exists
      const { data: post, error: postError } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (postError || !post) {
        return new Response(JSON.stringify({ error: 'Post not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Record the share
      const { error: shareError } = await supabase
        .from('blog_shares')
        .insert({
          post_id: id,
          user_id: userId,
          platform: platform,
          shared_at: new Date().toISOString(),
        });

      if (shareError) {
        console.error('Error recording share:', shareError);
        return new Response(JSON.stringify({ error: 'Failed to record share' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get updated share count
      const { data: shares } = await supabase
        .from('blog_shares')
        .select('id')
        .eq('post_id', id);

      const shareCount = shares?.length || 0;

      return new Response(JSON.stringify({ 
        success: true,
        share_count: shareCount,
        platform 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        .select("id, title, content, reviewed_by")
        .eq("id", id)
        .maybeSingle();
      if (!post) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { isAdmin } = await getUserRoleFlags(supabase, user!.id);
      
      // Check if user can review (admin, reviewed_by, or has assignment)
      let canReview = isAdmin || post.reviewed_by === user!.id;
      if (!canReview) {
        const { data: assignment } = await supabase
          .from('blog_review_assignments')
          .select('id')
          .eq('post_id', id)
          .eq('reviewer_id', user!.id)
          .eq('status', 'pending')
          .maybeSingle();
        canReview = !!assignment;
      }
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
        .select("id, author_id, reviewed_by, status")
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

    // Blog Metrics for dashboard analytics
    if (req.method === "GET" && pathname === "/api/blogs/metrics") {
      const { isAdmin, isGuru } = await getUserRoleFlags(supabase, user.id);
      if (!isAdmin && !isGuru) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      try {
        // KPIs - status counts using individual queries
        const [
          { count: draftCount },
          { count: inReviewCount },
          { count: publishedCount },
          { count: rejectedCount }
        ] = await Promise.all([
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'rejected')
        ]);

        const statusMap = {
          draft: draftCount || 0,
          in_review: inReviewCount || 0,
          published: publishedCount || 0,
          rejected: rejectedCount || 0
        };

        // Turnaround calculation (days from submission to publication)
        const { data: turnaroundData } = await supabase
          .from('blog_posts')
          .select('submitted_at, published_at')
          .not('submitted_at', 'is', null)
          .not('published_at', 'is', null)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(50);

        const avgTurnaround = turnaroundData?.length 
          ? turnaroundData.reduce((sum, post) => {
              const days = (new Date(post.published_at).getTime() - new Date(post.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / turnaroundData.length
          : 0;

        const kpis = {
          submitted: statusMap['in_review'] || 0,
          assigned: 0, // Will calculate from assignments
          published: statusMap['published'] || 0,
          rejected: statusMap['rejected'] || 0,
          turnaround_avg_days: Math.round(avgTurnaround * 10) / 10
        };

        // Active assignments count
        const { count: assignedCount } = await supabase
          .from('blog_review_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        kpis.assigned = assignedCount || 0;

        // Workload distribution (for admins)
        let workload = { total_active_assignments: kpis.assigned, per_guru: [] };
        if (isAdmin) {
          const { data: guruWorkload } = await supabase
            .from('blog_review_assignments')
            .select(`
              reviewer_id,
              profiles!reviewer_id(full_name)
            `)
            .eq('status', 'pending');

          const workloadMap = (guruWorkload as any[])?.reduce((acc, assignment) => {
            const guruId = assignment.reviewer_id;
            const name = assignment.profiles?.full_name || 'Unknown';
            if (!acc[guruId]) acc[guruId] = { guru_id: guruId, name, active_assignments: 0 };
            acc[guruId].active_assignments++;
            return acc;
          }, {}) || {};

          workload.per_guru = Object.values(workloadMap);
        }

        // Trends - weekly data for last 12 weeks
        const weeksAgo = 12;
        const trends = { submissions: [], publications: [], reviews_completed: [] };
        
        for (let i = weeksAgo - 1; i >= 0; i--) {
          const weekStart = new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000));
          const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
          const weekLabel = `${weekStart.getFullYear()}-${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;

          // Submissions
          const { count: submissionCount } = await supabase
            .from('blog_posts')
            .select('id', { count: 'exact', head: true })
            .gte('submitted_at', weekStart.toISOString())
            .lt('submitted_at', weekEnd.toISOString());

          trends.submissions.push({ week: weekLabel, count: submissionCount || 0 });

          // Publications
          const { count: publicationCount } = await supabase
            .from('blog_posts')
            .select('id', { count: 'exact', head: true })
            .gte('published_at', weekStart.toISOString())
            .lt('published_at', weekEnd.toISOString());

          trends.publications.push({ week: weekLabel, count: publicationCount || 0 });

          // Reviews completed (for guru-specific metrics)
          if (isGuru && !isAdmin) {
            const { count: reviewCount } = await supabase
              .from('blog_review_logs')
              .select('id', { count: 'exact', head: true })
              .eq('actor_id', user.id)
              .in('action', ['publish', 'request_changes', 'reject'])
              .gte('created_at', weekStart.toISOString())
              .lt('created_at', weekEnd.toISOString());

            trends.reviews_completed.push({ week: weekLabel, count: reviewCount || 0 });
          }
        }

        // Get engagement totals
        const { data: posts } = await supabase
          .from('blog_posts')
          .select(`
            view_count,
            likes_count,
            id
          `)
          .eq('status', 'published');

        const { data: commentCounts } = await supabase
          .from('blog_comments')
          .select('post_id')
          .in('post_id', posts?.map(p => p.id) || []);

        const { data: shareCounts } = await supabase
          .from('blog_shares')
          .select('post_id')
          .in('post_id', posts?.map(p => p.id) || []);

        const { data: feedbackCounts } = await supabase
          .from('blog_post_feedback')
          .select('post_id, status')
          .in('post_id', posts?.map(p => p.id) || []);

        const totalViews = posts?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;
        const totalLikes = posts?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
        const totalComments = commentCounts?.length || 0;
        const totalShares = shareCounts?.length || 0;
        const totalFeedback = feedbackCounts?.length || 0;
        const unresolvedFeedback = feedbackCounts?.filter(f => f.status === 'new').length || 0;
        const resolvedFeedback = feedbackCounts?.filter(f => f.status === 'resolved').length || 0;

        const engagement = {
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          feedback: totalFeedback
        };

        const feedback_summary = {
          unresolved: unresolvedFeedback,
          resolved: resolvedFeedback,
          total: totalFeedback
        };

        const metrics = { kpis, workload, trends, engagement, feedback_summary };
        return new Response(JSON.stringify(metrics), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Metrics error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch metrics" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
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
          { method: "POST", path: "/api/blogs/:id/share" },
          { method: "GET", path: "/api/blogs/metrics" },
          { method: "GET", path: "/api/blogs/admin?status=" },
          { method: "GET", path: "/api/user/feedback" },
          { method: "GET", path: "/api/admin/feedback" },
          { method: "POST", path: "/api/blogs/feedback/:id/resolve" },
          { method: "GET", path: "/api/blogs/:id/discussions" },
          { method: "POST", path: "/api/blogs/:id/discussions" },
          { method: "DELETE", path: "/api/blogs/discussions/:id" }
        ]
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
