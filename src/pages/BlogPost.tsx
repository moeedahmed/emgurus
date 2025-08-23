import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import DOMPurify from "dompurify";
import { Eye, ThumbsUp, MessageCircle, Share2, Flag, Sparkles } from "lucide-react";
import ReportIssueModal from "@/components/blogs/ReportIssueModal";
import AuthorChip from "@/components/blogs/AuthorChip";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import CommentThread from "@/components/blogs/CommentThread";
import ShareButtons from "@/components/blogs/ShareButtons";
import { sharePost } from "@/lib/blogsApi";
import { toast } from "sonner";

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
  const [shareCount, setShareCount] = useState<number>(0);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [engagement, setEngagement] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      
      // Load blog data from API for complete engagement data
      try {
        const response = await fetch(`/functions/v1/blogs-api/api/blogs/${slug}`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const apiData = await response.json();
          const current = apiData.post || null;
          setPost(current);
          
          const eng = apiData.engagement;
          if (eng) {
            setViewCount(eng.views ?? 0);
            setLikeCount(eng.likes ?? 0);
            setShareCount(eng.shares ?? 0);
            setFeedbackCount(eng.feedback ?? 0);
            setCommentCount(eng.comments ?? 0);
            setEngagement(eng);
          }
          
          // Set AI summary from API
          if (apiData.ai_summary?.summary_md) {
            setAiSummaryContent(apiData.ai_summary.summary_md);
          }
          
          // Set comments from API  
          if (apiData.comments) {
            setComments(apiData.comments);
          }
        } else {
          // Fallback to direct supabase query
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
        }
      } catch (error) {
        console.error("Failed to load blog data:", error);
        // Final fallback
        const { data } = await supabase
          .from("blog_posts")
          .select("id,title,description,cover_at,content,tags,author_id,reviewed_by,reviewed_at,view_count,likes_count,slug")
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle();
        const current = (data as any) || null;
        setPost(current);
        setViewCount(current?.view_count ?? 0);
        setLikeCount(current?.likes_count ?? 0);
      }

      // Fetch author profile data if not already loaded
      if (post?.author_id && !author) {
        const authorData = await supabase
          .from("profiles")
          .select("user_id,full_name,avatar_url,bio,title")
          .eq("user_id", post.author_id)
          .maybeSingle();
        
        setAuthor(authorData.data as AuthorProfile | null);
      }

      if (post?.tags?.length) {
        const { data: rel } = await supabase
          .from("blog_posts")
          .select("id,title,description,cover_image_url,created_at,content,tags,author_id,reviewed_by,reviewed_at,slug")
          .eq("status", "published")
          .limit(12);
        const relFiltered = ((rel as any[]) || [])
          .filter((p) => p.slug !== slug)
          .filter((p) => (p.tags || []).some((t: string) => post.tags.includes(t)))
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
    if (!post) return;

    // Fallback values
    const title = post.title || "EMGurus Blog";
    const description = post.description || "Read this blog post on EMGurus.";
    const imageUrl = post.cover_image_url || `${window.location.origin}/assets/logo-em-gurus.png`;
    const authorName = author?.full_name || "EMGurus Contributor";
    const canonicalUrl = `${window.location.origin}/blogs/${slug}`;

    // Set page title
    document.title = `${title} | EMGurus Blog`;
    
    // Update or create meta description
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);

    // Create OpenGraph meta tags
    const ogTags = [
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:image", content: imageUrl },
      { property: "og:site_name", content: "EMGurus" }
    ];

    // Create Twitter meta tags
    const twitterTags = [
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl }
    ];

    // Add or update meta tags
    const addedTags: HTMLMetaElement[] = [];
    [...ogTags, ...twitterTags].forEach((tag) => {
      const attr = 'property' in tag ? 'property' : 'name';
      const value = 'property' in tag ? tag.property : tag.name;
      let element = document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, value);
        document.head.appendChild(element);
        addedTags.push(element);
      }
      element.setAttribute("content", tag.content);
    });

    // JSON-LD structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "description": description,
      "image": imageUrl,
      "author": {
        "@type": "Person",
        "name": authorName
      },
      "datePublished": post.created_at,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl
      }
    };

    // Add or update JSON-LD script
    let jsonLdScript = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
    if (!jsonLdScript) {
      jsonLdScript = document.createElement("script");
      jsonLdScript.setAttribute("type", "application/ld+json");
      document.head.appendChild(jsonLdScript);
    }
    jsonLdScript.textContent = JSON.stringify(jsonLd);

    // Canonical link
    let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    return () => {
      // Cleanup only newly added tags
      addedTags.forEach(tag => {
        if (document.head.contains(tag)) {
          document.head.removeChild(tag);
        }
      });
      if (document.head.contains(jsonLdScript)) {
        document.head.removeChild(jsonLdScript);
      }
      if (document.head.contains(canonical)) {
        document.head.removeChild(canonical);
      }
    };
  }, [post, author, slug]);

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

  const handleShare = async (platform: string) => {
    if (!post?.id) return;
    
    try {
      const result = await sharePost(post.id, platform);
      if (result.share_count) {
        setShareCount(result.share_count);
      }
      toast.success(`Shared on ${platform}`);
    } catch (error) {
      console.error("Failed to track share:", error);
      // Still show success since the share itself worked
      toast.success(`Shared on ${platform}`);
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
                  avatar={author.avatar_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E"}
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
            {shareCount > 0 && (
              <span className="flex items-center gap-1">📤 {shareCount}</span>
            )}
          </div>
        </header>

        {/* Standardized Engagement Bar */}
        <div className="mb-6 p-4 sm:p-6 bg-muted/30 rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
              {/* Views */}
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Views: </span>
                {viewCount}
              </span>
              
              {/* Likes */}
              <button 
                className="flex items-center gap-1 hover:text-foreground transition-colors" 
                onClick={toggleLike}
                aria-label="Like this article"
              >
                <ThumbsUp className={`h-4 w-4 ${liked ? 'fill-current text-primary' : ''}`} />
                <span className="hidden sm:inline">Likes: </span>
                {likeCount}
              </button>
              
              {/* Comments */}
              <span className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Comments: </span>
                {commentCount}
              </span>
              
              {/* Shares */}
              <span className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Shares: </span>
                {shareCount}
              </span>
              
              {/* Feedback */}
              {feedbackCount > 0 && (
                <span className="flex items-center gap-1">
                  <Flag className="h-4 w-4" />
                  <span className="hidden sm:inline">Feedback: </span>
                  {feedbackCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <ShareButtons
                title={post.title}
                url={`${window.location.origin}/blog/${slug}`}
                text={post.description || "Check out this blog post on EMGurus"}
                postId={post.id}
                shareCount={shareCount}
                onShare={handleShare}
                variant="inline"
              />
              <ReportIssueModal postId={post.id} postTitle={post.title} />
            </div>
          </div>
        </div>

        {/* AI Summary - Always show, auto-generate if missing */}
        <CollapsibleCard
          title="AI Summary"
          titleIcon={<Sparkles className="h-4 w-4 text-primary" />}
          badge={<Badge variant="secondary" className="text-xs">AI-generated</Badge>}
          className="mb-6"
          defaultOpen={false}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {aiSummaryContent ? (
              <div 
                className="whitespace-pre-wrap text-sm"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(aiSummaryContent
                    .replace(/^-\s+/gm, '• ')
                    .replace(/^\*\s+/gm, '• '))
                }}
              />
            ) : (
              <p className="text-muted-foreground">Generating AI summary...</p>
            )}
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              Disclaimer: This summary may contain inaccuracies. Verify clinical content.
            </p>
          </div>
        </CollapsibleCard>

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

        <CollapsibleCard
          title="Article Content"
          defaultOpen={true}
          className="mb-6"
        >
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {post.content && (
              isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || "") }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-base">{post.content}</pre>
              )
            )}
          </div>
        </CollapsibleCard>

        {/* Share & Report Section */}
        <section className="mt-8 pt-6 border-t">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Share this article</h3>
              <ShareButtons
                title={post.title}
                url={`${window.location.origin}/blog/${slug}`}
                text={post.description || "Check out this blog post on EMGurus"}
                postId={post.id}
                shareCount={shareCount}
                onShare={handleShare}
                variant="dropdown"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <h3 className="text-sm font-medium">Found an issue?</h3>
              <p className="text-xs text-muted-foreground">
                Help us improve by reporting medical inaccuracies, typos, or other issues.
              </p>
            </div>
            <ReportIssueModal 
              postId={post.id} 
              postTitle={post.title}
            />
          </div>
        </section>

        {/* References placeholder */}
        <section className="mt-10">
          {/* Add references when available */}
        </section>
        {related.length > 0 && (
          <CollapsibleCard
            title="Related Articles"
            defaultOpen={false}
            className="mt-8"
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {p.cover_image_url && (
                    <img
                      src={p.cover_image_url}
                      alt={`Cover image for ${p.title}`}
                      className="w-full h-32 object-cover hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold text-sm mb-2 line-clamp-2 story-link">{p.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-3">{summarize(p.description || p.content)}</p>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/blog/${(p as any).slug}`}>Read more →</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleCard>
        )}

        <CollapsibleCard
          title={`Comments ${commentCount > 0 ? `(${commentCount})` : ''}`}
          titleIcon={<MessageCircle className="h-4 w-4" />}
          defaultOpen={true}
          className="mt-8"
        >
          <CommentThread 
            postId={post.id} 
            comments={comments} 
            onCommentsChange={(updatedComments) => {
              setComments(updatedComments);
              const totalComments = updatedComments.reduce((acc: number, comment: any) => {
                return acc + 1 + (comment.replies?.length || 0);
              }, 0);
              setCommentCount(totalComments);
            }}
          />
        </CollapsibleCard>
      </article>
    </main>
  );
};

export default BlogPost;
