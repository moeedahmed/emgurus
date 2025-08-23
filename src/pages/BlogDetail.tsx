import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBlog } from "@/lib/blogsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuthorChip from "@/components/blogs/AuthorChip";
import ReactionBar from "@/components/blogs/ReactionBar";
import CommentThread from "@/components/blogs/CommentThread";
import ShareButtons from "@/components/blogs/ShareButtons";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Eye, ThumbsUp, MessageCircle, Share2, Flag, Sparkles, Play, FileText, Image } from "lucide-react";
import ReportIssueModal from "@/components/blogs/ReportIssueModal";

export default function BlogDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorProfile, setAuthorProfile] = useState<any | null>(null);
  const [reviewerProfile, setReviewerProfile] = useState<any | null>(null);
  const [engagementCounts, setEngagementCounts] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    feedback: 0
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getBlog(slug!);
        setData(res);
        
        // Set engagement counts from response
        if (res.counts) {
          setEngagementCounts({
            views: res.counts.views || 0,
            likes: res.counts.likes || 0,
            comments: res.counts.comments || 0,
            shares: res.counts.shares || 0,
            feedback: res.counts.feedback || 0
          });
        }

        // SEO metadata
        document.title = `${res.title} | EMGurus`;
        const meta = document.querySelector("meta[name='description']");
        if (meta) meta.setAttribute("content", res.excerpt || res.title);
        
        // Add canonical link
        let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement;
        if (!canonical) {
          canonical = document.createElement("link");
          canonical.setAttribute("rel", "canonical");
          document.head.appendChild(canonical);
        }
        canonical.setAttribute("href", `${window.location.origin}/blogs/${slug}`);
      } catch (e: any) {
        toast.error(e.message || "Failed to load post");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!data) return;
      const ids: string[] = [data.author?.id, data.reviewer?.id].filter(Boolean) as string[];
      if (!ids.length) return;
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, avatar_url, bio, title, specialty').in('user_id', ids);
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setAuthorProfile(map.get(data.author?.id || '') || null);
      if (data.reviewer?.id) setReviewerProfile(map.get(data.reviewer.id) || null);
    };
    fetchProfiles();
  }, [data]);

  const processMediaEmbeds = (html: string): string => {
    // YouTube embeds
    html = html.replace(
      /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g,
      '<div class="my-6"><iframe width="100%" height="315" src="https://www.youtube.com/embed/$4" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>'
    );
    
    // Vimeo embeds
    html = html.replace(
      /(https?:\/\/)?(www\.)?vimeo\.com\/(\d+)/g,
      '<div class="my-6"><iframe width="100%" height="315" src="https://player.vimeo.com/video/$3" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>'
    );
    
    // Audio embeds
    html = html.replace(
      /(https?:\/\/[^\s]+\.(mp3|wav|ogg|m4a))/g,
      '<div class="my-6"><audio controls class="w-full"><source src="$1" type="audio/mpeg">Your browser does not support the audio element.</audio></div>'
    );
    
    // PDF embeds
    html = html.replace(
      /(https?:\/\/[^\s]+\.pdf)/g,
      '<div class="my-6 p-4 border rounded-lg bg-muted/20"><div class="flex items-center gap-2 mb-2"><FileText className="h-4 w-4" /><span class="font-medium">PDF Document</span></div><embed src="$1" type="application/pdf" width="100%" height="400" class="rounded" /></div>'
    );
    
    return html;
  };

  const contentHtml = useMemo(() => {
    if (!data) return "";
    let html = data.content_html || data.content || data.content_md || "";
    
    // Convert markdown-style content to HTML if needed
    if (html && typeof html === 'string') {
      // Basic markdown to HTML conversions
      html = html
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/^(.)/g, '<p>$1')
        .replace(/(.)$/g, '$1</p>');
      
      // Process media embeds
      html = processMediaEmbeds(html);
    }
    
    return DOMPurify.sanitize(html);
  }, [data]);

  const aiSummary = useMemo(() => {
    if (data?.ai_summary?.summary_md) {
      return data.ai_summary.summary_md;
    }
    // Auto-generate basic summary from content
    if (data?.content || data?.content_html || data?.content_md) {
      const text = (data.content || data.content_html || data.content_md)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
    }
    return "Summary will be generated automatically.";
  }, [data]);

  const handleEngagementUpdate = (newCounts: any) => {
    setEngagementCounts(prev => ({ ...prev, ...newCounts }));
  };

  if (loading) return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="h-96 animate-pulse" />
    </main>
  );
  
  if (!data) return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="p-6">Article not found</Card>
    </main>
  );

  const p = data;
  const readTime = (() => {
    const text = (data.content || data.content_md || data.content_html || "").toString();
    const words = text.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  })();

  return (
    <main className="min-h-screen">
      {/* Hero Section with Cover Image */}
      {p.cover_image_url && (
        <div className="relative w-full h-[60vh] overflow-hidden">
          <img 
            src={p.cover_image_url} 
            alt={`${p.title} cover image`} 
            className="w-full h-full object-cover" 
            loading="eager" 
            decoding="async" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="container mx-auto">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                {p.title}
              </h1>
              <div className="flex items-center gap-4 text-white/90">
                <AuthorChip 
                  id={p.author.id} 
                  name={authorProfile?.full_name || p.author.name} 
                  avatar={authorProfile?.avatar_url || p.author.avatar} 
                  onClick={(id) => navigate(`/profile/${id}`)}
                  className="text-white"
                />
                <span>•</span>
                <span>{p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}</span>
                <span>•</span>
                <span>{readTime} min read</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="text-sm text-muted-foreground mb-8">
          <button className="hover:underline" onClick={() => navigate('/')}>Home</button>
          <span className="mx-2">›</span>
          <button className="hover:underline" onClick={() => navigate('/blogs')}>Blogs</button>
          {p.category?.title && !/^imported$/i.test(p.category.title) && (
            <>
              <span className="mx-2">›</span>
              <button className="hover:underline" onClick={() => navigate(`/blogs?category=${encodeURIComponent(p.category.title)}`)}>{p.category.title}</button>
            </>
          )}
          <span className="mx-2">›</span>
          <span className="text-foreground">{p.title}</span>
        </nav>

        {/* No cover image fallback - show title */}
        {!p.cover_image_url && (
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{p.title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <AuthorChip 
                id={p.author.id} 
                name={authorProfile?.full_name || p.author.name} 
                avatar={authorProfile?.avatar_url || p.author.avatar} 
                onClick={(id) => navigate(`/profile/${id}`)}
              />
              <span>•</span>
              <span>{p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}</span>
              <span>•</span>
              <span>{readTime} min read</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <article className="lg:col-span-8 space-y-6">
            
            {/* Standardized Engagement Bar */}
            <div className="p-4 sm:p-6 bg-muted/30 rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Views: </span>
                    {engagementCounts.views}
                  </span>
                  
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Likes: </span>
                    {engagementCounts.likes}
                  </span>
                  
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Comments: </span>
                    {engagementCounts.comments}
                  </span>
                  
                  <span className="flex items-center gap-1">
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Shares: </span>
                    {engagementCounts.shares}
                  </span>
                  
                  {engagementCounts.feedback > 0 && (
                    <span className="flex items-center gap-1">
                      <Flag className="h-4 w-4" />
                      <span className="hidden sm:inline">Feedback: </span>
                      {engagementCounts.feedback}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <ShareButtons
                    title={p.title}
                    url={window.location.href}
                    text={p.excerpt || "Check out this blog post on EMGurus"}
                    postId={p.id}
                    shareCount={engagementCounts.shares}
                    onShare={(platform: string) => {
                      setEngagementCounts(prev => ({ ...prev, shares: prev.shares + 1 }));
                      toast.success(`Shared on ${platform}`);
                    }}
                    variant="inline"
                  />
                  <ReportIssueModal postId={p.id} postTitle={p.title} />
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <CollapsibleCard
              title="AI Summary"
              titleIcon={<Sparkles className="h-4 w-4 text-primary" />}
              badge={<Badge variant="secondary" className="text-xs">AI-generated</Badge>}
              className="transition-all duration-300 ease-in-out"
              defaultOpen={false}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">{aiSummary}</p>
              </div>
            </CollapsibleCard>

            {/* Main Content */}
            <CollapsibleCard
              title="Article Content"
              className="transition-all duration-300 ease-in-out"
              defaultOpen={true}
            >
              <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </CollapsibleCard>

            {/* Author Card */}
            <section className="mt-8">
              <Card className="p-6 rounded-2xl">
                <div className="flex items-start gap-4">
                  <AuthorChip 
                    id={p.author.id} 
                    name={authorProfile?.full_name || p.author.name} 
                    avatar={authorProfile?.avatar_url || p.author.avatar} 
                    onClick={(id) => navigate(`/profile/${id}`)} 
                  />
                  <div className="flex-1">
                    <div className="font-medium text-lg">{authorProfile?.full_name || p.author.name}</div>
                    {authorProfile?.title && <div className="text-sm text-muted-foreground">{authorProfile.title}</div>}
                    {authorProfile?.bio && <div className="text-sm text-muted-foreground mt-2">{authorProfile.bio}</div>}
                  </div>
                </div>
                
                {/* Reviewer Attribution */}
                {data.reviewer && (
                  <div className="mt-4 pt-4 border-t flex items-start gap-4">
                    <AuthorChip 
                      id={data.reviewer.id} 
                      name={reviewerProfile?.full_name || data.reviewer.name} 
                      avatar={reviewerProfile?.avatar_url || data.reviewer.avatar} 
                      onClick={(id) => navigate(`/profile/${id}`)} 
                    />
                    <div>
                      <div className="font-medium">Reviewed by {reviewerProfile?.full_name || data.reviewer.name}</div>
                      {reviewerProfile?.bio && <div className="text-sm text-muted-foreground">{reviewerProfile.bio}</div>}
                    </div>
                  </div>
                )}
              </Card>
            </section>

            {/* Comments with optimistic updates */}
            <section className="mt-8" id="comments">
              <h2 className="text-xl font-semibold mb-4">Comments</h2>
              <CommentThread
                postId={p.id}
                comments={data.comments || []}
                onCommentsChange={(comments) => {
                  setData((d: any) => ({ ...d, comments }));
                  setEngagementCounts(prev => ({ ...prev, comments: comments.length }));
                }}
              />
            </section>
          </article>

          {/* Sidebar - reserved for future content */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Future: Related posts, ads, etc. */}
          </aside>
        </div>
      </div>

      {/* Mobile Sticky Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              {engagementCounts.likes}
            </Button>
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {engagementCounts.comments}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => {
              const el = document.getElementById('comments');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>Comment</Button>
            <ShareButtons title={p.title} url={window.location.href} text={p.excerpt || ""} size="sm" />
          </div>
        </div>
      </div>
    </main>
  );
}