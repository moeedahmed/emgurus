export type ReactionKey = "like" | "love" | "insightful" | "curious" | "thumbs_up" | "thumbs_down";

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: { id?: string; slug?: string; title?: string } | null;
  tags: { slug: string; title: string }[];
  author: { id: string; name: string; avatar: string | null };
  reading_minutes: number | null;
  published_at: string | null;
  counts: { likes: number; comments: number; views: number };
}

export interface BlogDetailPayload {
  post: BlogListItem & {
    content_md?: string | null;
    content_html?: string | null;
    content?: string | null;
    reviewer?: { id: string; name: string; avatar: string | null } | null;
  };
  reactions: Record<string, number>;
  comments: Array<{
    id: string;
    author_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
    author?: { user_id: string; full_name: string; avatar_url: string | null } | null;
    replies?: any[];
  }>;
  ai_summary: { provider: string; model: string; summary_md: string; created_at: string } | null;
}

const BASE = "https://cgtvvpzrzwyvsbavboxa.functions.supabase.co/blogs-api";

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
  q?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: BlogListItem[]; page: number; page_size: number; total: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.tag) qs.set("tag", params.tag);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
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
      .select("id, title, slug, description, cover_image_url, category_id, author_id, status, view_count, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false });

    // Resolve category by slug or title/name if provided
    let categoryId: string | undefined;
    if (params.category) {
      const { data: catBySlug } = await supabase
        .from("blog_categories")
        .select("id, slug, title, name")
        .or(`slug.eq.${params.category},title.eq.${params.category},name.eq.${params.category}`)
        .maybeSingle();
      categoryId = catBySlug?.id;
      if (categoryId) query = query.eq("category_id", categoryId);
    }

    const { data: basePosts, error: baseErr } = await query;
    if (baseErr) throw baseErr;
    let posts = basePosts ?? [];

    // Tag filter
    if (params.tag) {
      const { data: tag } = await supabase.from("blog_tags").select("id, slug").eq("slug", params.tag).maybeSingle();
      if (tag) {
        const { data: links } = await supabase
          .from("blog_post_tags")
          .select("post_id")
          .eq("tag_id", tag.id);
        const allowed = new Set((links ?? []).map((l: any) => l.post_id));
        posts = posts.filter((p: any) => allowed.has(p.id));
      }
    }

    // Text query
    if (params.q) {
      const s = params.q.toLowerCase();
      posts = posts.filter((p: any) => p.title.toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s));
    }

    const total = posts.length;
    const start = (page - 1) * pageSize;
    const pageItems = posts.slice(start, start + pageSize);

    // Batch author & category
    const authorIds = Array.from(new Set(pageItems.map((p: any) => p.author_id)));
    const categoryIds = Array.from(new Set(pageItems.map((p: any) => p.category_id).filter(Boolean)));
    const [{ data: authors }, { data: categories }] = await Promise.all([
      authorIds.length ? supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds) : Promise.resolve({ data: [] as any[] } as any),
      categoryIds.length ? supabase.from("blog_categories").select("id, title, slug").in("id", categoryIds) : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const authorMap: Map<string, any> = new Map((authors ?? []).map((a: any) => [a.user_id as string, a]));
    const categoryMap: Map<string, any> = new Map((categories ?? []).map((c: any) => [c.id as string, c]));

    const ids = pageItems.map((p: any) => p.id);
    const [reactionsRes, commentsRes, tagRowsRes] = await Promise.all([
      ids.length ? supabase.from("blog_reactions").select("post_id, reaction").in("post_id", ids) : Promise.resolve({ data: [] as any[] } as any),
      ids.length ? supabase.from("blog_comments").select("post_id").in("post_id", ids) : Promise.resolve({ data: [] as any[] } as any),
      ids.length ? supabase.from("blog_post_tags").select("post_id, tag:blog_tags(slug, title)").in("post_id", ids) : Promise.resolve({ data: [] as any[] } as any),
    ]);

    const likesCount = new Map<string, number>();
    for (const r of reactionsRes.data ?? []) {
      if (r.reaction === "thumbs_down") continue;
      likesCount.set(r.post_id, (likesCount.get(r.post_id) ?? 0) + 1);
    }
    const commentsCount = new Map<string, number>();
    for (const c of commentsRes.data ?? []) commentsCount.set(c.post_id, (commentsCount.get(c.post_id) ?? 0) + 1);

    const tagMap = new Map<string, { slug: string; title: string }[]>();
    for (const row of tagRowsRes.data ?? []) {
      const arr = tagMap.get(row.post_id) ?? [];
      if (row.tag) arr.push(row.tag);
      tagMap.set(row.post_id, arr);
    }

    const items: BlogListItem[] = pageItems.map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.description ?? null,
      cover_image_url: p.cover_image_url ?? null,
      category: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
      tags: tagMap.get(p.id) ?? [],
      author: (() => {
        const a = authorMap.get(p.author_id);
        return a ? { id: p.author_id, name: a.full_name, avatar: a.avatar_url ?? null } : { id: p.author_id, name: "Unknown", avatar: null };
      })(),
      reading_minutes: null,
      published_at: p.created_at ?? null,
      counts: {
        likes: likesCount.get(p.id) ?? 0,
        comments: commentsCount.get(p.id) ?? 0,
        views: p.view_count ?? 0,
      },
    }));

    return { items, page, page_size: pageSize, total };
  }
}

export async function getBlog(slug: string): Promise<BlogDetailPayload> {
  try {
    const res = await fetch(`${BASE}/api/blogs/${encodeURIComponent(slug)}`, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    // Fallback: build payload directly from Supabase
    const { data: post } = await supabase.from("blog_posts").select("*").eq("slug", slug).maybeSingle();
    if (!post) throw new Error("Post not found");

    const [authorRes, reviewerRes, reactionsRes, commentsRes, summaryRes, tagsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", post.author_id).maybeSingle(),
      post.reviewer_id || post.reviewed_by
        ? supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", post.reviewer_id ?? post.reviewed_by).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("blog_reactions").select("reaction").eq("post_id", post.id),
      supabase.from("blog_comments").select("id, author_id, parent_id, content, created_at").eq("post_id", post.id).order("created_at", { ascending: true }),
      supabase.from("blog_ai_summaries").select("provider, model, summary_md, created_at").eq("post_id", post.id).maybeSingle(),
      supabase.from("blog_post_tags").select("tag:blog_tags(slug, title)").eq("post_id", post.id),
    ]);

    const reactions = new Map<string, number>();
    for (const r of reactionsRes.data ?? []) reactions.set(r.reaction as string, (reactions.get(r.reaction as string) ?? 0) + 1);

    // Build threaded comments (2-level)
    const comments = (commentsRes.data ?? []).map((c: any) => ({ ...c, author: undefined as any, replies: [] as any[] }));
    const byId = new Map(comments.map((c: any) => [c.id, c]));
    const roots: any[] = [];
    for (const c of comments) {
      if (c.parent_id && byId.get(c.parent_id)) byId.get(c.parent_id).replies.push(c);
      else roots.push(c);
    }
    const commentAuthorIds = Array.from(new Set(comments.map((c: any) => c.author_id)));
    if (commentAuthorIds.length) {
      const { data: cAuthors } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", commentAuthorIds);
      const cmap = new Map((cAuthors ?? []).map((a: any) => [a.user_id, a]));
      for (const c of comments) c.author = cmap.get(c.author_id) ?? null;
    }

    const payload: BlogDetailPayload = {
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.description ?? null,
        cover_image_url: post.cover_image_url ?? null,
        category: null,
        tags: (tagsRes.data ?? []).map((t: any) => t.tag).filter(Boolean),
        author: authorRes.data ? { id: post.author_id, name: authorRes.data.full_name, avatar: authorRes.data.avatar_url ?? null } : { id: post.author_id, name: "Unknown", avatar: null },
        reading_minutes: null,
        published_at: post.created_at ?? null,
        counts: { likes: Array.from(reactions.entries()).filter(([k]) => k !== "thumbs_down").reduce((a, [, v]) => a + (v as number), 0), comments: comments.length, views: post.view_count ?? 0 },
        content: post.content ?? null,
      },
      reactions: Object.fromEntries(reactions),
      comments: roots as any,
      ai_summary: summaryRes.data ?? null,
    };

    return payload;
  }
}

export async function createDraft(body: {
  title: string;
  content_md?: string;
  content_html?: string;
  category_id?: string;
  tag_slugs?: string[];
  cover_image_url?: string;
  excerpt?: string;
}): Promise<{ id: string; slug: string }> {
  const content = body.content_md ?? body.content_html ?? null;
  const { data, error } = await supabase.rpc('create_blog_draft', {
    p_title: body.title,
    p_content_md: content,
    p_category_id: body.category_id ?? null,
    p_tags: body.tag_slugs ?? []
  });
  if (error) throw new Error(error.message || 'Failed to create draft');
  const row: any = Array.isArray(data) ? data[0] : data; // some clients wrap
  return { id: row.id, slug: row.slug };
}

export async function updateDraft(id: string, body: {
  title?: string;
  content_md?: string;
  content_html?: string;
  category_id?: string;
  tag_slugs?: string[];
  cover_image_url?: string;
  excerpt?: string;
}) {
  const patch: Record<string, any> = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.excerpt === 'string') patch.description = body.excerpt;
  if (typeof body.cover_image_url === 'string') patch.cover_image_url = body.cover_image_url;
  if (typeof body.content_md === 'string' || typeof body.content_html === 'string')
    patch.content = (body.content_md ?? body.content_html) ?? null;
  if (typeof body.category_id === 'string') patch.category_id = body.category_id;

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('blog_posts').update(patch).eq('id', id);
    if (error) throw new Error(error.message || 'Failed to update draft');
  }

  if (body.tag_slugs) {
    await supabase.from('blog_post_tags').delete().eq('post_id', id);
    if (body.tag_slugs.length) {
      const { data: tags, error: tErr } = await supabase.from('blog_tags').select('id, slug').in('slug', body.tag_slugs);
      if (tErr) throw new Error(tErr.message);
      const links = (tags ?? []).map((t: any) => ({ post_id: id, tag_id: t.id }));
      if (links.length) {
        const { error: lErr } = await supabase.from('blog_post_tags').insert(links);
        if (lErr) throw new Error(lErr.message);
      }
    }
  }

  return { ok: true, id };
}

export async function submitPost(id: string) {
  const { error } = await supabase.rpc('submit_blog_for_review', { p_post_id: id });
  if (error) throw new Error(error.message || 'Failed to submit');
  return { ok: true };
}

export async function reviewPost(id: string, body: { notes?: string; is_featured?: boolean; is_editors_pick?: boolean }) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/review`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to review");
  return res.json();
}

export async function publishPost(id: string) {
  const headers = { ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/publish`, { method: "POST", headers });
  if (!res.ok) throw new Error("Failed to publish");
  return res.json();
}

export async function reactToPost(id: string, reaction: ReactionKey): Promise<{ toggled: boolean }> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/react`, { method: "POST", headers, body: JSON.stringify({ reaction }) });
  if (!res.ok) throw new Error("Failed to react");
  return res.json();
}

export async function commentOnPost(id: string, content: string, parent_id?: string | null) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/comment`, { method: "POST", headers, body: JSON.stringify({ content, parent_id: parent_id ?? null }) });
  if (!res.ok) throw new Error("Failed to comment");
  return res.json();
}

export async function refreshAISummary(id: string) {
  const headers = { ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/ai-summary`, { method: "POST", headers });
  if (!res.ok) throw new Error("Failed to refresh AI summary");
  return res.json();
}
