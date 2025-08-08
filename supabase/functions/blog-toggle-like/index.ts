import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await authSupabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");

    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    const userId = userData.user.id;

    // Check if like exists
    const { data: likeRow } = await supabase
      .from('blog_likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (likeRow) {
      // Unlike
      await supabase.from('blog_likes').delete().eq('id', likeRow.id);
    } else {
      // Like
      await supabase.from('blog_likes').insert({ post_id, user_id: userId });
    }

    // Recalculate total likes for consistency
    const { count } = await supabase
      .from('blog_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post_id);

    const likes_count = count ?? 0;
    await supabase.from('blog_posts').update({ likes_count }).eq('id', post_id);

    return new Response(JSON.stringify({ success: true, liked: !likeRow, likes_count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
