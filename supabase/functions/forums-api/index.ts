// Forums API - Supabase Edge Function
// Public GET endpoints, authenticated POST endpoints
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
function bad(msg = "Bad Request") { return json({ error: msg }, 400); }
function unauthorized(msg = "Unauthorized") { return json({ error: msg }, 401); }
function serverError(msg: string, details?: unknown) { console.error(msg, details); return json({ error: msg }, 500); }

function getServiceClient() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

function getBearer(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.replace("Bearer ", "");
}
function supaFor(req: Request) {
  const token = getBearer(req);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function getAuthUser(req: Request) {
  const token = getBearer(req);
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const supabase = supaFor(req);

    // GET /api/forum/categories
    if (path.endsWith("/api/forum/categories") && req.method === "GET") {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("id, title, description, created_at, updated_at")
        .order("title");
      if (error) return serverError("Failed to list categories", error);
      return json({ items: data });
    }

    // GET /api/forum/threads?category_id=...
    if (path.endsWith("/api/forum/threads") && req.method === "GET") {
      const categoryId = url.searchParams.get("category_id");
      let q = supabase
        .from("forum_threads")
        .select("id, category_id, author_id, title, content, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data: threads, error } = await q;
      if (error) return serverError("Failed to list threads", error);

      // Enrich with author info and reply counts using service role
      const svc = getServiceClient();
      const authorIds = Array.from(new Set((threads || []).map((t: any) => t.author_id)));
      const threadIds = (threads || []).map((t: any) => t.id);

      let authors: Record<string, { name: string; avatar_url: string | null }> = {};
      if (authorIds.length) {
        const { data: profs } = await svc
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", authorIds);
        (profs || []).forEach((p: any) => { authors[p.user_id] = { name: p.full_name || 'User', avatar_url: p.avatar_url || null }; });
      }

      let replyCounts: Record<string, number> = {};
      if (threadIds.length) {
        const { data: reps } = await svc
          .from("forum_replies")
          .select("thread_id")
          .in("thread_id", threadIds);
        (reps || []).forEach((r: any) => { replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1; });
      }

      const items = (threads || []).map((t: any) => ({
        ...t,
        author: { id: t.author_id, name: authors[t.author_id]?.name || 'User', avatar_url: authors[t.author_id]?.avatar_url || null },
        reply_count: replyCounts[t.id] || 0,
      }));

      return json({ items });
    }

    // GET /api/forum/threads/:id
    const threadMatch = path.match(/\/api\/forum\/threads\/([^/]+)$/);
    if (threadMatch && req.method === "GET") {
      const id = threadMatch[1];
      const { data: thread, error: te } = await supabase
        .from("forum_threads")
        .select("id, category_id, author_id, title, content, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (te) return serverError("Failed to load thread", te);
      if (!thread) return bad("Thread not found");

      const { data: replies, error: re } = await supabase
        .from("forum_replies")
        .select("id, thread_id, author_id, content, created_at")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });
      if (re) return serverError("Failed to load replies", re);

      // Enrich authors with service role
      const svc = getServiceClient();
      const authorIds = Array.from(new Set([thread.author_id, ...(replies || []).map((r: any) => r.author_id)]));
      let authors: Record<string, { name: string; avatar_url: string | null }> = {};
      if (authorIds.length) {
        const { data: profs } = await svc
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", authorIds);
        (profs || []).forEach((p: any) => { authors[p.user_id] = { name: p.full_name || 'User', avatar_url: p.avatar_url || null }; });
      }

      // Reactions per reply (and legacy likes)
      const ids = (replies || []).map((r: any) => r.id);
      const currentUser = await getAuthUser(req);
      let reactionCounts: Record<string, Record<string, number>> = {};
      let userReacts: Record<string, Set<string>> = {};
      if (ids.length) {
        const { data: reactRows } = await svc
          .from("forum_reactions")
          .select("reply_id, reaction, user_id")
          .in("reply_id", ids);
        (reactRows || []).forEach((row: any) => {
          reactionCounts[row.reply_id] = reactionCounts[row.reply_id] || {};
          reactionCounts[row.reply_id][row.reaction] = (reactionCounts[row.reply_id][row.reaction] || 0) + 1;
          if (currentUser && row.user_id === currentUser.id) {
            userReacts[row.reply_id] = userReacts[row.reply_id] || new Set<string>();
            userReacts[row.reply_id].add(row.reaction);
          }
        });
        // Back-compat: also include legacy forum_likes as 'like'
        const { data: likesRows } = await svc
          .from("forum_likes")
          .select("reply_id")
          .in("reply_id", ids);
        (likesRows || []).forEach((row: any) => {
          reactionCounts[row.reply_id] = reactionCounts[row.reply_id] || {};
          reactionCounts[row.reply_id]["like"] = (reactionCounts[row.reply_id]["like"] || 0) + 1;
        });
      }

      const repliesWith = (replies || []).map((r: any) => {
        const counts = reactionCounts[r.id] || {};
        const likes_count = (counts["like"] || counts["thumbs_up"] || 0);
        return {
          ...r,
          likes_count,
          reaction_counts: counts,
          user_reactions: Array.from(userReacts[r.id] || []),
          author: { id: r.author_id, name: authors[r.author_id]?.name || 'User', avatar_url: authors[r.author_id]?.avatar_url || null },
        };
      });
      const threadOut = {
        ...thread,
        author: { id: thread.author_id, name: authors[thread.author_id]?.name || 'User', avatar_url: authors[thread.author_id]?.avatar_url || null },
      };
      return json({ thread: threadOut, replies: repliesWith });
    }

    // Auth-only endpoints below
    // POST /api/forum/threads { category_id, title, content }
    if (path.endsWith("/api/forum/threads") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const body = await req.json().catch(() => null) as any;
      if (!body) return bad("Invalid JSON body");
      const { category_id, title, content } = body || {};
      if (!category_id || !title || !content) return bad("category_id, title, content required");
      if (String(content).trim().length < 10) return bad("Content must be at least 10 characters");
      if (String(title).trim().length < 5) return bad("Title must be at least 5 characters");

      const { data, error } = await supabase
        .from("forum_threads")
        .insert({ category_id, author_id: user.id, title, content })
        .select()
        .maybeSingle();
      if (error) return serverError("Failed to create thread", error);
      return json({ thread: data });
    }

    // POST /api/forum/replies { thread_id, content, parent_id? }
    if (path.endsWith("/api/forum/replies") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const body = await req.json().catch(() => null) as any;
      if (!body) return bad("Invalid JSON body");
      const { thread_id, content, parent_id } = body || {};
      if (!thread_id || !content) return bad("thread_id and content required");
      if (String(content).trim().length < 10) return bad("Content must be at least 10 characters");

      const insertPayload: any = { thread_id, author_id: user.id, content };
      if (parent_id) insertPayload.parent_id = parent_id;

      const { data, error } = await supabase
        .from("forum_replies")
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (error) return serverError("Failed to create reply", error);
      return json({ reply: data });
    }

    // POST /api/forum/likes { reply_id } (back-compat) -> records a 'like' reaction
    if (path.endsWith("/api/forum/likes") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const body = await req.json().catch(() => null) as any;
      if (!body) return bad("Invalid JSON body");
      const { reply_id } = body || {};
      if (!reply_id) return bad("reply_id required");

      const { error } = await supabase
        .from("forum_reactions")
        .insert({ reply_id, user_id: user.id, reaction: 'like' });
      if (error) {
        // Ignore duplicate reactions (unique constraint)
        // @ts-ignore
        if ((error as any).code === '23505') return json({ ok: true, duplicate: true });
        return serverError("Failed to react to reply", error);
      }
      return json({ ok: true });
    }

    // POST /api/forum/reactions { reply_id, reaction, toggle? }
    if (path.endsWith("/api/forum/reactions") && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const body = await req.json().catch(() => null) as any;
      if (!body) return bad("Invalid JSON body");
      const { reply_id, reaction, toggle } = body || {};
      if (!reply_id || !reaction) return bad("reply_id and reaction required");

      const { error } = await supabase
        .from("forum_reactions")
        .insert({ reply_id, user_id: user.id, reaction });
      if (error) {
        // If duplicate and toggle requested, remove it (acts as toggle)
        // @ts-ignore
        if ((error as any).code === '23505' && toggle) {
          await supabase.from("forum_reactions").delete().eq("reply_id", reply_id).eq("user_id", user.id).eq("reaction", reaction);
          return json({ ok: true, toggledOff: true });
        }
        // Ignore duplicate otherwise
        // @ts-ignore
        if ((error as any).code === '23505') return json({ ok: true, duplicate: true });
        return serverError("Failed to react to reply", error);
      }
      return json({ ok: true });
    }

    // DELETE /api/forum/reactions?reply_id=...&reaction=...
    if (path.endsWith("/api/forum/reactions") && req.method === "DELETE") {
      const user = await getAuthUser(req);
      if (!user) return unauthorized();
      const rid = url.searchParams.get("reply_id");
      const reaction = url.searchParams.get("reaction");
      if (!rid || !reaction) return bad("reply_id and reaction required");
      const { error } = await supabase
        .from("forum_reactions")
        .delete()
        .eq("reply_id", rid)
        .eq("reaction", reaction)
        .eq("user_id", user.id);
      if (error) return serverError("Failed to remove reaction", error);
      return json({ ok: true });
    }

    return json({ error: "Not Found" }, 404);
  } catch (e) {
    return serverError("Unexpected error", e);
  }
});
