import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import DOMPurify from "dompurify";
import { Eye, ThumbsUp, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import ReportIssueModal from "@/components/blogs/ReportIssueModal";
import AuthorChip from "@/components/blogs/AuthorChip";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import CommentThread from "@/components/blogs/CommentThread";

interface Post {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  content: string | null;
  tags: string[] | null;
  author_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  view_count?: number | null;
  likes_count?: number | null;
}

interface AuthorProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  title: string | null;
}

const pseudoCount = (seed: string, base: number, spread = 500) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return base + (h % spread);
};

const readTime = (content?: string | null) => {
  if (!content) return 3;
  const words = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const summarize = (html?: string | null, max = 420) => {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
};

const BlogPost = () => {
const { slug } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [viewCount, setViewCount] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [aiSummaryContent, setAiSummaryContent] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,description,cover_image_url,created_at,content,tags,author_id,reviewed_by,reviewed_at,view_count,likes_count,slug")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      const current = (data as any) || null;
      setPost(current);
      setViewCount(current?.view_count ?? 0);
      setLikeCount(current?.likes_count ?? 0);

      // Fetch author profile data and AI summary
      if (current?.author_id) {
        const [authorData, summaryData] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id,full_name,avatar_url,bio,title")
            .eq("user_id", current.author_id)
            .maybeSingle(),
          supabase
            .from("blog_ai_summaries")
            .select("summary_md")
            .eq("post_id", current.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ]);
        
        setAuthor(authorData.data as AuthorProfile | null);
        setAiSummaryContent(summaryData.data?.summary_md || null);

        // Load comments
        try {
          const response = await fetch(`/functions/v1/blogs-api/api/blogs/${current.id}/comments`);
          if (response.ok) {
            const commentsData = await response.json();
            setComments(commentsData.comments || []);
            // Count total comments including replies
            const totalComments = (commentsData.comments || []).reduce((acc: number, comment: any) => {
              return acc + 1 + (comment.replies?.length || 0);
            }, 0);
            setCommentCount(totalComments);
          }
        } catch (error) {
          console.error("Failed to load comments:", error);
        }
      }

      if (current?.tags?.length) {
        const { data: rel } = await supabase
          .from("blog_posts")
          .select("id,title,description,cover_image_url,created_at,content,tags,author_id,reviewed_by,reviewed_at,slug")
          .eq("status", "published")
          .limit(12);
        const relFiltered = ((rel as any[]) || [])
          .filter((p) => p.slug !== slug)
          .filter((p) => (p.tags || []).some((t: string) => current.tags.includes(t)))
          .slice(0, 3);
        setRelated(relFiltered as any);
      } else {
        setRelated([]);
      }
      setLoading(false);
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

  useEffect(() => {
    if (!post?.id) return;
    const storageKey = `blog_viewed_${post.id}`;
    if (sessionStorage.getItem(storageKey)) return;
    supabase.functions.invoke("blog-record-view", { body: { post_id: post.id } })
      .then(({ data, error }) => {
        if (!error && data && typeof data.view_count === 'number') {
          setViewCount(data.view_count);
          sessionStorage.setItem(storageKey, '1');
        }
      });
  }, [post?.id]);

  useEffect(() => {
    if (!user || !post?.id) return;
    supabase.from('blog_likes').select('id').eq('post_id', post.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user?.id, post?.id]);

  const toggleLike = async () => {
    if (!user || !post?.id) {
      alert('Please sign in to like');
      return;
    };
    const { data, error } = await supabase.functions.invoke('blog-toggle-like', { body: { post_id: post.id } });
    if (!error && data) {
      setLiked(!!data.liked);
      if (typeof data.likes_count === 'number') setLikeCount(data.likes_count);
    }
  };

  const publishedDate = useMemo(() =>
    post?.created_at ? new Date(post.created_at) : null
  , [post?.created_at]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-8 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card className="p-6">Article not found or not published.</Card>
      </main>
    );
  }

  const isHtml = /<\w+[^>]*>/.test(post.content || "");
  const minutes = readTime(post.content);
  const aiSummary = summarize(post.content);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="mb-6 text-sm">
        <Link to="/blog" className="text-muted-foreground hover:text-foreground">← Back to Blog</Link>
      </nav>

      <article className="max-w-3xl mx-auto">
        <header className="mb-4">
          <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
          {post.description && (
            <p className="text-muted-foreground mb-3">{post.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {author && (
              <div className="flex items-center gap-3">
                <AuthorChip 
                  id={author.user_id}
                  name={author.full_name || "EMGurus Contributor"}
                  avatar={author.avatar_url}
                  className="text-sm"
                />
                <div className="text-xs">
                  <div className="font-medium text-foreground">{author.title || "Medical Professional"}</div>
                  {author.bio && (
                    <div className="text-muted-foreground mt-1 max-w-md line-clamp-2">{author.bio}</div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {publishedDate && (
              <span title={publishedDate.toLocaleString()}>
                {publishedDate.toLocaleDateString()} • {minutes} min read
              </span>
            )}
            <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {viewCount}</span>
            <button className="inline-flex items-center gap-1 hover:opacity-80" onClick={toggleLike} aria-label="Like this article">
              <ThumbsUp className="h-4 w-4" /> {likeCount}
            </button>
            {commentCount > 0 && (
              <span className="flex items-center gap-1">💬 {commentCount}</span>
            )}
          </div>
        </header>

        {/* AI Summary */}
        {aiSummaryContent && (
          <CollapsibleCard
            title="AI Summary"
            titleIcon={<Sparkles className="h-4 w-4 text-primary" />}
            badge={<Badge variant="secondary" className="text-xs">AI-generated</Badge>}
            className="mb-6"
            defaultOpen={false}
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div 
                className="whitespace-pre-wrap text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(aiSummaryContent
                    .replace(/^-\s+/gm, '• ')
                    .replace(/^\*\s+/gm, '• '))
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              Disclaimer: This summary may contain inaccuracies. Verify clinical content.
            </p>
          </CollapsibleCard>
        )}

        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={`Cover image for ${post.title}`} className="w-full max-h-96 object-cover rounded-md mb-6" loading="lazy" />
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {(post.tags || ["General"]).map((t) => (
            <Link key={t} to={`/blog/category/${encodeURIComponent(t)}`}>
              <Badge variant="outline" className="cursor-pointer">{t}</Badge>
            </Link>
          ))}
        </div>

        <section className="prose dark:prose-invert max-w-none">
          {post.content && (
            isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || "") }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-base">{post.content}</pre>
            )
          )}
        </section>

        {/* Report Issue */}
        <section className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Found an issue?</h3>
              <p className="text-xs text-muted-foreground">
                Help us improve by reporting medical inaccuracies, typos, or other issues.
              </p>
            </div>
            <ReportIssueModal postId={post.id} postTitle={post.title} />
          </div>
        </section>

        {/* References placeholder */}
        <section className="mt-10">
          {/* Add references when available */}
        </section>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="max-w-5xl mx-auto mt-12">
          <h3 className="text-xl font-semibold mb-4">Related Articles</h3>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                {p.cover_image_url && (
                  <img
                    src={p.cover_image_url}
                    alt={`Cover image for ${p.title}`}
                    className="w-full h-36 object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-4">
                  <h4 className="font-semibold mb-2 line-clamp-2">{p.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/blog/${(p as any).slug}`}>Read</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <section className="max-w-3xl mx-auto mt-12">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">
              Discussion {commentCount > 0 && `(${commentCount})`}
            </h3>
          </div>
          <CommentThread 
            postId={post.id} 
            comments={comments}
            onCommentsChange={(newComments) => {
              setComments(newComments);
              const totalComments = newComments.reduce((acc: number, comment: any) => {
                return acc + 1 + (comment.replies?.length || 0);
              }, 0);
              setCommentCount(totalComments);
            }}
          />
        </Card>
      </section>

      <link rel="canonical" href={`${window.location.origin}/blog/${slug}`} />
    </main>
  );
};

export default BlogPost;
