import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Post {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  content: string | null;
}

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,description,cover_image_url,created_at,content")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      setPost((data as any) || null);
    };
    load();
  }, [slug]);

  useEffect(() => {
    if (post?.title) {
      document.title = `${post.title} | EMGurus Blog`;
      const meta = document.querySelector("meta[name='description']");
      if (meta) meta.setAttribute("content", post.description || "EMGurus medical article");
    }
  }, [post]);

  if (!post) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card className="p-6">Article not found or not published.</Card>
      </main>
    );
  }

  const isHtml = /<\w+[^>]*>/.test(post.content || "");

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="mb-6 text-sm">
        <Link to="/blog" className="text-muted-foreground hover:text-foreground">← Back to Blog</Link>
      </nav>
      <article className="prose dark:prose-invert max-w-none">
        <h1 className="mb-2">{post.title}</h1>
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={`Cover image for ${post.title}`} className="w-full max-h-96 object-cover rounded-md mb-6" loading="lazy" />
        )}
        {post.description && <p className="text-muted-foreground mb-4">{post.description}</p>}
        {post.content && (
          isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-base">{post.content}</pre>
          )
        )}
      </article>
      <link rel="canonical" href={`${window.location.origin}/blog/${slug}`} />
    </main>
  );
};

export default BlogPost;
