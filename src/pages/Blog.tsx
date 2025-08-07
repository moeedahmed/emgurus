import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
interface PostItem {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  slug: string | null;
}

const Blog = () => {
  const [posts, setPosts] = useState<PostItem[]>([]);

  useEffect(() => {
    document.title = "EMGurus Blog | Medical Insights";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "EMGurus blog with peer-reviewed medical articles and updates.");
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,description,cover_image_url,created_at,slug")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      setPosts((data as any) || []);
    };
    load();
  }, []);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-6">EMGurus Blog</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            {p.cover_image_url && (
              <img
                src={p.cover_image_url}
                alt={`Cover image for ${p.title}`}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-semibold mb-2">{p.title}</h2>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{p.description}</p>
              {p.slug && (
                <Button variant="outline" asChild>
                  <Link to={`/blog/${p.slug}`} aria-label={`Read article ${p.title}`}>Read Article</Link>
                </Button>
              )}
            </div>
          </Card>
        ))}
        {posts.length === 0 && (
          <Card className="p-6">No articles yet. Gurus can publish from the Review page.</Card>
        )}
      </div>
    </main>
  );
};

export default Blog;
