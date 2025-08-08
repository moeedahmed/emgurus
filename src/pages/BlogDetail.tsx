import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBlog, refreshAISummary } from "@/lib/blogsApi";
import { Card } from "@/components/ui/card";
import AuthorChip from "@/components/blogs/AuthorChip";
import ReactionBar from "@/components/blogs/ReactionBar";
import CommentThread from "@/components/blogs/CommentThread";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
import { toast } from "sonner";

export default function BlogDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const commentsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getBlog(slug!);
        setData(res);
        document.title = `${res.post.title} | EMGurus`;
        const meta = document.querySelector("meta[name='description']");
        if (meta) meta.setAttribute("content", res.post.excerpt || res.post.title);
      } catch (e: any) {
        toast.error(e.message || "Failed to load post");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const contentHtml = useMemo(() => {
    if (!data?.post) return "";
    const html = data.post.content_html || (data.post.content_md ? data.post.content_md.replace(/\n/g, "<br/>") : "");
    return DOMPurify.sanitize(html);
  }, [data]);

  if (loading) return <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8"><Card className="h-96 animate-pulse" /></main>;
  if (!data?.post) return <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8"><Card className="p-6">Not found</Card></main>;

  const p = data.post;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      {p.cover_image_url && (
        <div className="w-full max-h-[420px] overflow-hidden">
          <img src={p.cover_image_url} alt={`${p.title} cover image`} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* breadcrumbs */}
        <nav className="lg:col-span-12 text-sm text-muted-foreground">
          <button className="hover:underline" onClick={() => navigate('/blogs')}>Blogs</button>
          {p.category?.title && (
            <> <span className="mx-2">›</span>
              <button className="hover:underline" onClick={() => navigate(`/blogs?category=${encodeURIComponent(p.category.title)}`)}>{p.category.title}</button>
            </>
          )}
          <span className="mx-2">›</span>
          <span className="text-foreground">{p.title}</span>
        </nav>

        {/* title and meta */}
        <article className="lg:col-span-8 space-y-4">
          <h1 className="text-3xl font-bold">{p.title}</h1>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <AuthorChip id={p.author.id} name={p.author.name} avatar={p.author.avatar} onClick={(id) => navigate(`/profile/${id}`)} />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {p.category?.title && <span>{p.category.title}</span>}
              {p.reading_minutes && <span>{p.reading_minutes} min read</span>}
              {p.published_at && <span>{new Date(p.published_at).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* content */}
          <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />

          <div className="pt-4 border-t flex items-center justify-between">
            <ReactionBar postId={p.id} counts={{ likes: (data.reactions?.thumbs_up || 0) + (data.reactions?.like || 0) + (data.reactions?.love || 0) + (data.reactions?.insightful || 0) + (data.reactions?.curious || 0) }} />
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigator.share ? navigator.share({ title: p.title, url: window.location.href }) : navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied"))}>Share</Button>
            </div>
          </div>

          {/* comments */}
          <section className="mt-8" id="comments" ref={commentsRef}>
            <h2 className="text-xl font-semibold mb-4">Comments</h2>
            <CommentThread
              postId={p.id}
              comments={data.comments || []}
              onNewComment={(c) => setData((d: any) => ({ ...d, comments: [...(d.comments || []), c] }))}
            />
          </section>
        </article>

        {/* right column */}
        <aside className="lg:col-span-4 space-y-4">
          {/* AI summary panel */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">AI‑generated summary</h3>
              <button className="text-sm text-primary" onClick={async () => {
                try {
                  await refreshAISummary(p.id);
                  toast.success("Requested refresh");
                } catch (e: any) {
                  toast.error(e.message || "Failed");
                }
              }}>Refresh</button>
            </div>
            {data.ai_summary?.summary_md ? (
              <div className="mt-3 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {data.ai_summary.summary_md}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No summary yet.</p>
            )}
          </Card>
        </aside>
      </div>

      {/* sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <ReactionBar postId={p.id} counts={{ likes: (data.reactions?.thumbs_up || 0) + (data.reactions?.like || 0) + (data.reactions?.love || 0) + (data.reactions?.insightful || 0) + (data.reactions?.curious || 0) }} compact />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => {
              const el = document.getElementById('comments');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>Comment</Button>
            <Button size="sm" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied"))}>Share</Button>
          </div>
        </div>
      </div>
      <link rel="canonical" href={`${window.location.origin}/blogs/${encodeURIComponent(slug || "")}`} />
    </main>
  );
}
