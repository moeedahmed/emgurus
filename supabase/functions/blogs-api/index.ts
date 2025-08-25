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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE, PUT",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

function getClient(req: Request) {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } }
  });
}

async function getUserRoleFlags(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc('get_user_role_flags', { p_user_id: userId });
  if (error) {
    console.warn('Error fetching user roles:', error);
    return { is_admin: false, is_guru: false };
  }
  return data || { is_admin: false, is_guru: false };
}

// Validation schemas
const createDraftSchema = z.object({
  title: z.string().min(1),
  content: z.union([z.string(), z.array(z.any())]),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  excerpt: z.string().optional(),
});

const assignMultiReviewersSchema = z.object({
  action: z.literal('assign_reviewers'),
  post_id: z.string().uuid(),
  reviewer_ids: z.array(z.string().uuid()),
  note: z.string().optional(),
});

const reviewSchema = z.object({
  action: z.enum(['approve_publish', 'request_changes']),
  post_id: z.string().uuid(),
  review_notes: z.string().optional(),
});

const reactSchema = z.object({
  type: z.enum(['like', 'dislike']),
});

const commentSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().uuid().optional(),
});

function validateBlocks(content: any[]): boolean {
  if (!Array.isArray(content)) return false;
  return content.every(block => 
    block && typeof block === 'object' && 
    typeof block.type === 'string' && 
    block.data !== undefined
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function readingMinutesFrom({ md, html }: { md?: string; html?: string }): number {
  const text = md || stripHtml(html || '');
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

function generateAutoSummary(content: any): string {
  if (!content) return "";
  
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    // Extract text from blocks
    for (const block of content) {
      if (block?.data?.text) {
        text += block.data.text + " ";
      }
    }
  }
  
  if (!text.trim()) return "";
  
  // Generate summary from first few sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
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
  console.log(`blogs-api: ${req.method} ${req.url}`);
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

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = getClient(req);

  try {
    // Get user ID from auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userRoles = await getUserRoleFlags(supabase, userId);

    // Routes
    if ((path === "/api/blogs" || path === "/" || path === "") && req.method === "GET") {
      // List blogs with filtering
      const status = url.searchParams.get("status");
      const category = url.searchParams.get("category");
      const author = url.searchParams.get("author");
      const search = url.searchParams.get("search");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const featured = url.searchParams.get("featured") === "true";
      const orderBy = url.searchParams.get("orderBy") || "created_at";
      const orderDirection = url.searchParams.get("orderDirection") || "desc";

      let query = supabase
        .from("blog_posts")
        .select(`
          *,
          category:blog_categories(id, name, slug),
          author:profiles!blog_posts_author_id_fkey(user_id, full_name, avatar_url),
          tags:blog_post_tags(tag:blog_tags(id, name, slug))
        `)
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (category) {
        query = query.eq("category_id", category);
      }
      if (author) {
        query = query.eq("author_id", author);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
      }
      if (featured) {
        query = query.eq("featured", true);
      }

      // Apply ordering
      query = query.order(orderBy, { ascending: orderDirection === "asc" });

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ blogs: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+$/) && req.method === "GET") {
      // Get single blog by slug
      const slug = path.split("/").pop();
      
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          category:blog_categories(id, name, slug),
          author:profiles!blog_posts_author_id_fkey(user_id, full_name, avatar_url),
          tags:blog_post_tags(tag:blog_tags(id, name, slug))
        `)
        .eq("slug", slug)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ blog: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((path === "/api/blogs" || path === "/" || path === "") && req.method === "POST") {
      const body = await req.json();
      
      // Handle multi-reviewer assignment
      if (body.action === "assign_reviewers") {
        const { post_id, reviewer_ids, note } = assignMultiReviewersSchema.parse(body);
        
        if (!userRoles.is_admin) {
          return new Response(JSON.stringify({ error: "Only admins can assign reviewers" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Insert multiple review assignments
        const assignments = reviewer_ids.map(reviewer_id => ({
          post_id,
          reviewer_id,
          assigned_by: userId,
          notes: note || "",
          status: "pending"
        }));

        const { error: assignmentError } = await supabase
          .from("blog_review_assignments")
          .insert(assignments);

        if (assignmentError) {
          return new Response(JSON.stringify({ error: assignmentError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update the blog post with the first reviewer for backward compatibility
        const { error: updateError } = await supabase
          .from("blog_posts")
          .update({ reviewer_id: reviewer_ids[0] })
          .eq("id", post_id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Reviewers assigned successfully" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create blog draft
      const { title, content, category_id, tags, status, description, excerpt } = createDraftSchema.parse(body);

      // Generate slug
      let slug = slugify(title);
      let slugCounter = 0;
      let finalSlug = slug;

      // Ensure unique slug
      while (true) {
        const { data: existingPost } = await supabase
          .from("blog_posts")
          .select("id")
          .eq("slug", finalSlug)
          .single();

        if (!existingPost) break;
        
        slugCounter++;
        finalSlug = `${slug}-${slugCounter}`;
      }

      // Process content
      let processedContent = content;
      let contentMd = "";
      let readingTime = 1;

      if (typeof content === "string") {
        contentMd = content;
        readingTime = readingMinutesFrom({ md: content });
      } else if (Array.isArray(content)) {
        if (!validateBlocks(content)) {
          return new Response(JSON.stringify({ error: "Invalid content format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Convert blocks to markdown or keep as is
        contentMd = content.map(block => block.data?.text || "").join("\n");
        readingTime = readingMinutesFrom({ md: contentMd });
      }

      // Generate auto-summary if description not provided
      const autoDescription = description || generateAutoSummary(content);

      // Create blog post
      const { data: post, error: createError } = await supabase
        .from("blog_posts")
        .insert({
          title,
          slug: finalSlug,
          content: processedContent,
          description: autoDescription,
          excerpt,
          category_id,
          author_id: userId,
          status: status || "draft",
          reading_time: readingTime
        })
        .select()
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle tags
      if (tags && tags.length > 0) {
        const tagInserts = tags.map(tagSlug => ({
          post_id: post.id,
          tag_id: tagSlug // Assuming tag slugs are passed and we need to resolve them
        }));

        // Get tag IDs by slugs
        const { data: tagData } = await supabase
          .from("blog_tags")
          .select("id, slug")
          .in("slug", tags);

        if (tagData && tagData.length > 0) {
          const validTagInserts = tagData.map(tag => ({
            post_id: post.id,
            tag_id: tag.id
          }));

          await supabase
            .from("blog_post_tags")
            .insert(validTagInserts);
        }
      }

      return new Response(JSON.stringify({ blog: post, id: post.id }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+$/) && req.method === "PUT") {
      // Update blog post
      const id = path.split("/").pop();
      const body = await req.json();
      const { title, content, category_id, tags, status, description, excerpt } = createDraftSchema.parse(body);

      // Check if user owns the post or is admin
      const { data: existingPost } = await supabase
        .from("blog_posts")
        .select("author_id")
        .eq("id", id)
        .single();

      if (!existingPost) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingPost.author_id !== userId && !userRoles.is_admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process content and calculate reading time
      let contentMd = "";
      let readingTime = 1;

      if (typeof content === "string") {
        contentMd = content;
        readingTime = readingMinutesFrom({ md: content });
      } else if (Array.isArray(content)) {
        if (!validateBlocks(content)) {
          return new Response(JSON.stringify({ error: "Invalid content format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        contentMd = content.map(block => block.data?.text || "").join("\n");
        readingTime = readingMinutesFrom({ md: contentMd });
      }

      const autoDescription = description || generateAutoSummary(content);

      // Update post
      const { data: post, error: updateError } = await supabase
        .from("blog_posts")
        .update({
          title,
          content,
          description: autoDescription,
          excerpt,
          category_id,
          status,
          reading_time: readingTime
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update tags
      if (tags) {
        // Remove existing tags
        await supabase
          .from("blog_post_tags")
          .delete()
          .eq("post_id", id);

        // Add new tags
        if (tags.length > 0) {
          const { data: tagData } = await supabase
            .from("blog_tags")
            .select("id, slug")
            .in("slug", tags);

          if (tagData && tagData.length > 0) {
            const validTagInserts = tagData.map(tag => ({
              post_id: id,
              tag_id: tag.id
            }));

            await supabase
              .from("blog_post_tags")
              .insert(validTagInserts);
          }
        }
      }

      return new Response(JSON.stringify({ blog: post }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/submit$/) && req.method === "POST") {
      // Submit blog for review
      const id = path.split("/")[3];

      // Check if user owns the post
      const { data: existingPost } = await supabase
        .from("blog_posts")
        .select("author_id, status")
        .eq("id", id)
        .single();

      if (!existingPost) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingPost.author_id !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingPost.status !== "draft") {
        return new Response(JSON.stringify({ error: "Only drafts can be submitted for review" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update status to in_review
      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({ 
          status: "in_review",
          submitted_at: new Date().toISOString()
        })
        .eq("id", id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Blog submitted for review" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/review$/) && req.method === "POST") {
      // Review blog post (approve/publish or request changes)
      const id = path.split("/")[3];
      const body = await req.json();
      const { action, review_notes } = reviewSchema.parse(body);

      // Check if user can review (admin, guru, or assigned reviewer)
      const canReview = userRoles.is_admin || userRoles.is_guru;
      const isAssignedReviewer = await supabase
        .from("blog_review_assignments")
        .select("id")
        .eq("post_id", id)
        .eq("reviewer_id", userId)
        .eq("status", "pending")
        .single();

      if (!canReview && !isAssignedReviewer.data) {
        return new Response(JSON.stringify({ error: "Unauthorized to review this post" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve_publish") {
        // Check if all assigned reviewers have approved
        const { data: assignments } = await supabase
          .from("blog_review_assignments")
          .select("status")
          .eq("post_id", id);

        const allApproved = assignments && assignments.length > 0 && 
          assignments.every(a => a.status === "completed");

        if (assignments && assignments.length > 0 && !allApproved) {
          // Mark this reviewer as completed
          await supabase
            .from("blog_review_assignments")
            .update({ status: "completed" })
            .eq("post_id", id)
            .eq("reviewer_id", userId);

          // Check again if all are now completed
          const { data: updatedAssignments } = await supabase
            .from("blog_review_assignments")
            .select("status")
            .eq("post_id", id);

          const nowAllApproved = updatedAssignments.every(a => a.status === "completed");

          if (!nowAllApproved) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: "Your review has been recorded. Waiting for other reviewers." 
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Publish the post
        const { error: publishError } = await supabase
          .from("blog_posts")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId,
            review_notes
          })
          .eq("id", id);

        if (publishError) {
          return new Response(JSON.stringify({ error: publishError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Blog published successfully" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } else if (action === "request_changes") {
        // Request changes - set back to draft
        const { error: updateError } = await supabase
          .from("blog_posts")
          .update({
            status: "draft",
            review_notes: review_notes || "Changes requested"
          })
          .eq("id", id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Changes requested" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/request-changes$/) && req.method === "POST") {
      const id = path.split("/")[3];
      const body = await req.json();
      const { review_notes } = body;

      // Check permissions
      const canReview = userRoles.is_admin || userRoles.is_guru;
      if (!canReview) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({
          status: "draft",
          review_notes: review_notes || "Changes requested"
        })
        .eq("id", id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Changes requested" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/reject$/) && req.method === "POST") {
      const id = path.split("/")[3];
      const body = await req.json();
      const { review_notes } = body;

      // Check permissions
      const canReview = userRoles.is_admin || userRoles.is_guru;
      if (!canReview) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({
          status: "rejected",
          review_notes: review_notes || "Post rejected"
        })
        .eq("id", id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Post rejected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/publish$/) && req.method === "POST") {
      const id = path.split("/")[3];

      // Only admins can publish directly
      if (!userRoles.is_admin) {
        return new Response(JSON.stringify({ error: "Only admins can publish posts" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: publishError } = await supabase
        .from("blog_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString()
        })
        .eq("id", id);

      if (publishError) {
        return new Response(JSON.stringify({ error: publishError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Post published" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/react$/) && req.method === "POST") {
      const id = path.split("/")[3];
      const body = await req.json();
      const { type } = reactSchema.parse(body);

      // Check if reaction already exists
      const { data: existingReaction } = await supabase
        .from("blog_reactions")
        .select("id, type")
        .eq("post_id", id)
        .eq("user_id", userId)
        .single();

      if (existingReaction) {
        if (existingReaction.type === type) {
          // Remove reaction if same type
          await supabase
            .from("blog_reactions")
            .delete()
            .eq("id", existingReaction.id);

          return new Response(JSON.stringify({ success: true, action: "removed" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Update reaction type
          await supabase
            .from("blog_reactions")
            .update({ type })
            .eq("id", existingReaction.id);

          return new Response(JSON.stringify({ success: true, action: "updated" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Create new reaction
        const { error: createError } = await supabase
          .from("blog_reactions")
          .insert({ post_id: id, user_id: userId, type });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, action: "created" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/comment$/) && req.method === "POST") {
      const id = path.split("/")[3];
      const body = await req.json();
      const { content, parent_id } = commentSchema.parse(body);

      const { data: comment, error: createError } = await supabase
        .from("blog_comments")
        .insert({
          post_id: id,
          user_id: userId,
          content,
          parent_id
        })
        .select(`
          *,
          author:profiles!blog_comments_user_id_fkey(user_id, full_name, avatar_url)
        `)
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ comment }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/comments$/) && req.method === "GET") {
      const id = path.split("/")[3];

      const { data: comments, error } = await supabase
        .from("blog_comments")
        .select(`
          *,
          author:profiles!blog_comments_user_id_fkey(user_id, full_name, avatar_url)
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ comments }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/comments\/[^\/]+$/) && req.method === "DELETE") {
      const commentId = path.split("/").pop();

      // Check if user owns the comment or is admin
      const { data: comment } = await supabase
        .from("blog_comments")
        .select("user_id")
        .eq("id", commentId)
        .single();

      if (!comment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (comment.user_id !== userId && !userRoles.is_admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabase
        .from("blog_comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Comment deleted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/feedback\/[^\/]+\/resolve$/) && req.method === "POST") {
      const feedbackId = path.split("/")[4];

      // Only admins and gurus can resolve feedback
      if (!userRoles.is_admin && !userRoles.is_guru) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("blog_feedback")
        .update({ 
          status: "resolved",
          resolved_by: userId,
          resolved_at: new Date().toISOString()
        })
        .eq("id", feedbackId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Feedback resolved" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/feedback$/) && req.method === "GET") {
      const id = path.split("/")[3];

      // Only admins and gurus can view feedback
      if (!userRoles.is_admin && !userRoles.is_guru) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: feedback, error } = await supabase
        .from("blog_feedback")
        .select(`
          *,
          reporter:profiles!blog_feedback_reported_by_fkey(user_id, full_name),
          resolver:profiles!blog_feedback_resolved_by_fkey(user_id, full_name)
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ feedback }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/ai-summary$/) && req.method === "POST") {
      const id = path.split("/")[3];

      // Get the blog post
      const { data: post, error: postError } = await supabase
        .from("blog_posts")
        .select("content, author_id")
        .eq("id", id)
        .single();

      if (postError || !post) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user can generate summary (author, admin, or guru)
      if (post.author_id !== userId && !userRoles.is_admin && !userRoles.is_guru) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const summary = generateAutoSummary(post.content);

      return new Response(JSON.stringify({ summary }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.match(/^\/api\/blogs\/[^\/]+\/share$/) && req.method === "POST") {
      const id = path.split("/")[3];
      const body = await req.json();
      const { platform } = body;

      // Track the share event
      const { error: shareError } = await supabase
        .from("blog_shares")
        .insert({
          post_id: id,
          user_id: userId,
          platform: platform || "unknown"
        });

      if (shareError) {
        console.warn("Failed to track share:", shareError);
      }

      return new Response(JSON.stringify({ success: true, message: "Share tracked" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/api/blogs/metrics" && req.method === "GET") {
      // Only admins can view metrics
      if (!userRoles.is_admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get various metrics
      const { data: totalPosts } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact" });

      const { data: publishedPosts } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact" })
        .eq("status", "published");

      const { data: draftPosts } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact" })
        .eq("status", "draft");

      const { data: reviewPosts } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact" })
        .eq("status", "in_review");

      const metrics = {
        totalPosts: totalPosts?.length || 0,
        publishedPosts: publishedPosts?.length || 0,
        draftPosts: draftPosts?.length || 0,
        reviewPosts: reviewPosts?.length || 0
      };

      return new Response(JSON.stringify({ metrics }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/api/blogs/docs" && req.method === "GET") {
      const docs = {
        title: "Blogs API Documentation",
        version: "1.0.0",
        endpoints: [
          {
            method: "GET",
            path: "/api/blogs",
            description: "List blog posts with filtering and pagination",
            parameters: [
              { name: "status", type: "string", description: "Filter by status (draft, in_review, published, rejected)" },
              { name: "category", type: "string", description: "Filter by category ID" },
              { name: "author", type: "string", description: "Filter by author ID" },
              { name: "search", type: "string", description: "Search in title and content" },
              { name: "featured", type: "boolean", description: "Filter featured posts" },
              { name: "limit", type: "number", description: "Number of posts to return (default: 20)" },
              { name: "offset", type: "number", description: "Number of posts to skip (default: 0)" },
              { name: "orderBy", type: "string", description: "Order by field (default: created_at)" },
              { name: "orderDirection", type: "string", description: "Order direction (asc, desc)" }
            ]
          },
          {
            method: "GET",
            path: "/api/blogs/{slug}",
            description: "Get a single blog post by slug"
          },
          {
            method: "POST",
            path: "/api/blogs",
            description: "Create a new blog draft or assign reviewers",
            body: {
              createDraft: {
                title: "string (required)",
                content: "string or array (required)",
                category_id: "uuid (optional)",
                tags: "array of strings (optional)",
                status: "string (optional, default: draft)",
                description: "string (optional)",
                excerpt: "string (optional)"
              },
              assignReviewers: {
                action: "assign_reviewers",
                post_id: "uuid (required)",
                reviewer_ids: "array of uuids (required)",
                note: "string (optional)"
              }
            }
          }
          // ... more endpoints would be documented here
        ]
      };

      return new Response(JSON.stringify(docs), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default 404 response
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
