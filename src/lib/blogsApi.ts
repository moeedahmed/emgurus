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
  const res = await fetch(`${BASE}/api/blogs?${qs.toString()}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error("Failed to load blogs");
  return res.json();
}

export async function getBlog(slug: string): Promise<BlogDetailPayload> {
  const res = await fetch(`${BASE}/api/blogs/${encodeURIComponent(slug)}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error("Post not found");
  return res.json();
}

export async function createDraft(body: {
  title: string;
  content_md?: string;
  content_html?: string;
  category_id?: string;
  tag_slugs?: string[];
  cover_image_url?: string;
  excerpt?: string;
}): Promise<{ slug: string }> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to create draft");
  return res.json();
}

export async function submitPost(id: string) {
  const headers = { ...(await authHeader()) };
  const res = await fetch(`${BASE}/api/blogs/${id}/submit`, { method: "POST", headers });
  if (!res.ok) throw new Error("Failed to submit");
  return res.json();
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
