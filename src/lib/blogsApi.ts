// This module contains the React Query hooks and functions for interacting with blogs
import { callFunction } from "@/lib/functionsUrl";
import { getErrorMessage } from "@/lib/errors";

export type ReactionKey = "thumbs_up" | "thumbs_down";

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  category?: { id: string; title?: string; slug?: string } | null;
  tags?: { slug?: string; title?: string }[];
  author?: { id: string; name: string; avatar?: string | null };
  reading_minutes?: number | null;
  published_at?: string | null;
  is_featured?: boolean;
  counts?: {
    likes?: number;
    comments?: number;
    views?: number;
    shares?: number;
  };
}

export interface BlogDetailPayload {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  category?: { id: string; title?: string; slug?: string } | null;
  tags?: { slug?: string; title?: string }[];
  author?: { id: string; name: string; avatar?: string | null };
  reading_minutes?: number | null;
  published_at?: string | null;
  counts?: {
    likes?: number;
    comments?: number;
    views?: number;
    shares?: number;
    feedback?: number;
  };
  engagement?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    feedback: number;
  };
  reactions?: { [key in ReactionKey]?: number };
  user_reaction?: ReactionKey | null;
  ai_summary?: string | null;
  comments?: any[];
}

// Primary API functions pointing to the blogs-api Edge Function
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blogs-api`;

import { supabase } from "@/integrations/supabase/client";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listBlogs(params: {
  status?: "draft" | "in_review" | "published" | "archived";
  category?: string;
  tag?: string;
  author?: string;
  sort?: string;
  q?: string;
  page?: number;
  page_size?: number;
  featured?: boolean;
}): Promise<{ items: BlogListItem[]; page: number; page_size: number; total: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.tag) qs.set("tag", params.tag);
  if (params.q) qs.set("q", params.q);
  if (params.author) qs.set("author", params.author);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.featured) qs.set("featured", "true");
  try {
    const res = await fetch(`${BASE}/api/blogs?${qs.toString()}`, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    // Fallback to direct Supabase query if Edge Function is temporarily unavailable or outdated
    const page = params.page ?? 1;
    const pageSize = Math.min(50, Math.max(1, params.page_size ?? 12));
    const status = params.status ?? "published";

    let query = supabase
      .from("blog_posts")
      .select("id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at, is_featured")
      .eq("status", status);
    
    if (params.featured) query = query.eq("is_featured", true);

    const { data: rawPosts, error } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw new Error(error.message);

    // Count total
    let countQuery = supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    
    if (params.featured) countQuery = countQuery.eq("is_featured", true);
    
    const { count } = await countQuery;

    // Fetch related data
    const authorIds = [...new Set(rawPosts?.map(p => p.author_id).filter(Boolean))];
    const categoryIds = [...new Set(rawPosts?.map(p => p.category_id).filter(Boolean))];

    const [authorsRes, categoriesRes] = await Promise.all([
      authorIds.length ? supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds) : Promise.resolve({ data: [] }),
      categoryIds.length ? supabase.from("blog_categories").select("id, title, slug").in("id", categoryIds) : Promise.resolve({ data: [] })
    ]);

    const authorMap = new Map((authorsRes.data || []).map((a: any) => [a.user_id, a]));
    const categoryMap = new Map((categoriesRes.data || []).map((c: any) => [c.id, c]));

    // Get tags for posts
    const postIds = rawPosts?.map(p => p.id) ?? [];
    const { data: tagData } = postIds.length 
      ? await supabase
          .from("blog_post_tags")
          .select("post_id, tag:blog_tags(slug, title)")
          .in("post_id", postIds)
      : { data: [] };

    const tagMap = new Map<string, any[]>();
    (tagData || []).forEach((t: any) => {
      if (!tagMap.has(t.post_id)) tagMap.set(t.post_id, []);
      tagMap.get(t.post_id)!.push(t.tag);
    });

    // Get reactions count for each post
    const { data: reactionData } = postIds.length
      ? await supabase
          .from("blog_reactions")
          .select("post_id, reaction")
          .in("post_id", postIds)
      : { data: [] };

    const likesCount = new Map<string, number>();
    (reactionData || []).forEach((r: any) => {
      if (r.reaction !== "thumbs_down") {
        likesCount.set(r.post_id, (likesCount.get(r.post_id) || 0) + 1);
      }
    });

    // Get comments count
    const { data: commentData } = postIds.length
      ? await supabase
          .from("blog_comments")
          .select("post_id")
          .in("post_id", postIds)
      : { data: [] };

    const commentsCount = new Map<string, number>();
    (commentData || []).forEach((c: any) => {
      commentsCount.set(c.post_id, (commentsCount.get(c.post_id) || 0) + 1);
    });

    const items: BlogListItem[] = (rawPosts || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.description ?? null,
      cover_image_url: p.cover_image_url ?? null,
      category: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
      tags: tagMap.get(p.id) ?? [],
      author: (() => {
        const a = authorMap.get(p.author_id) as any;
        return a ? { id: p.author_id, name: a.full_name || "Unknown", avatar: a.avatar_url ?? null } : { id: p.author_id, name: "Unknown", avatar: null };
      })(),
      reading_minutes: null,
      published_at: p.created_at ?? null,
      is_featured: p.is_featured ?? false,
      counts: {
        likes: likesCount.get(p.id) ?? 0,
        comments: commentsCount.get(p.id) ?? 0,
        views: p.view_count ?? 0,
      },
    }));

    return {
      items,
      page,
      page_size: pageSize,
      total: count ?? 0,
    };
  }
}

export async function getBlog(slug: string): Promise<BlogDetailPayload> {
  try {
    const res = await fetch(`${BASE}/api/blogs/${slug}`, { headers: await authHeader() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    // Fallback to direct Supabase query
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !post) throw new Error("Post not found");

    // Fetch related data including AI summary
    const [authorRes, categoryRes, tagsRes, aiSummaryRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", post.author_id).maybeSingle(),
      post.category_id ? supabase.from("blog_categories").select("id, title, slug").eq("id", post.category_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("blog_post_tags").select("tag:blog_tags(slug, title)").eq("post_id", post.id),
      supabase.from("blog_ai_summaries").select("summary_md").eq("post_id", post.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.description,
      content: post.content || "",
      cover_image_url: post.cover_image_url,
      category: categoryRes.data,
      tags: tagsRes.data?.map((t: any) => t.tag) || [],
      author: authorRes.data ? {
        id: post.author_id,
        name: authorRes.data.full_name || "Unknown",
        avatar: authorRes.data.avatar_url
      } : { id: post.author_id, name: "Unknown", avatar: null },
      reading_minutes: null,
      published_at: post.published_at || post.created_at,
      counts: { likes: 0, comments: 0, views: post.view_count || 0 },
      reactions: {},
      user_reaction: null,
      ai_summary: aiSummaryRes.data?.summary_md || null,
      comments: []
    };
  }
}

export async function createDraft(body: {
  title: string;
  content_md?: string;
  category_id?: string;
  tag_slugs?: string[];
  cover_image_url?: string;
  excerpt?: string;
}) {
  try {
    return await callFunction("/blogs-api", body, true, "POST");
  } catch (error: any) {
    const message = getErrorMessage(error, "Failed to create draft");
    throw new Error(message);
  }
}

export async function updateDraft(id: string, body: {
  title?: string;
  content_md?: string;
  category_id?: string;
  tag_slugs?: string[];
  cover_image_url?: string;
}) {
  const res = await fetch(`${BASE}/api/blogs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitPost(id: string) {
  try {
    return await callFunction(`/blogs-api/api/blogs/${id}/submit`, {}, true, "POST");
  } catch (error: any) {
    const message = getErrorMessage(error, "Failed to submit post");
    throw new Error(message);
  }
}

export async function reviewPost(id: string, body: {
  action: "approve" | "reject" | "request_changes";
  note?: string;
}) {
  try {
    return await callFunction(`/blogs-api/api/blogs/${id}/review`, body, true, "POST");
  } catch (error: any) {
    const message = getErrorMessage(error, "Failed to review post");
    throw new Error(message);
  }
}

export async function approveForPublishing(id: string) {
  try {
    return await callFunction(`/blogs-api/api/blogs/${id}/approve`, {}, true, "POST");
  } catch (error: any) {
    const message = getErrorMessage(error, "Failed to approve post");
    throw new Error(message);
  }
}

export async function publishPost(id: string) {
  try {
    return await callFunction(`/blogs-api/api/blogs/${id}/publish`, {}, true, "POST");
  } catch (error: any) {
    const message = getErrorMessage(error, "Failed to publish post");
    throw new Error(message);
  }
}

export async function reactToPost(id: string, reaction: ReactionKey) {
  const res = await fetch(`${BASE}/api/blogs/${id}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ reaction }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function commentOnPost(id: string, content: string, parent_id?: string) {
  const res = await fetch(`${BASE}/api/blogs/${id}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ content, parent_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refreshAISummary(id: string) {
  const res = await fetch(`${BASE}/api/blogs/${id}/ai-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sharePost(id: string, platform: string) {
  const res = await fetch(`${BASE}/api/blogs/${id}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ platform }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitFeedback(postId: string, message: string) {
  const res = await fetch(`${BASE}/api/blogs/${postId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}