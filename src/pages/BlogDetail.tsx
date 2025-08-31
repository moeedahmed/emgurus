import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBlog } from "@/lib/blogsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AuthorChip from "@/components/blogs/AuthorChip";
import ReactionBar from "@/components/blogs/ReactionBar";
import CommentThread from "@/components/blogs/CommentThread";
import ShareButtons from "@/components/blogs/ShareButtons";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { parseContentIntoSections, generateAuthorBio, ContentSection } from "@/lib/markdownRenderer";
import AuthorCard from "@/components/blogs/AuthorCard";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, ThumbsUp, ThumbsDown, MessageCircle, Share2, Flag, Sparkles, Play, FileText, Image, User } from "lucide-react";
import ReportIssueModal from "@/components/blogs/ReportIssueModal";

export default function BlogDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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


  const contentSections = useMemo(() => {
    if (!data) return [];
    const rawContent = data.content_html || data.content || data.content_md || "";
    return parseContentIntoSections(rawContent);
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

  const handleLikeBlog = async () => {
    if (!user?.id) {
      toast.error("Please log in to like this post");
      return;
    }
    
    // Optimistic update
    setEngagementCounts(prev => ({ ...prev, likes: prev.likes + 1 }));
    
    try {
      const response = await fetch(`/functions/v1/blog-toggle-like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postId: data.id })
      });
      
      if (!response.ok) {
        // Revert on error
        setEngagementCounts(prev => ({ ...prev, likes: prev.likes - 1 }));
        toast.error("Failed to like post");
      } else {
        toast.success("Post liked!");
      }
    } catch (error) {
      // Revert on error  
      setEngagementCounts(prev => ({ ...prev, likes: prev.likes - 1 }));
      toast.error("Failed to like post");
    }
  };

  const handleDislikeBlog = () => {
    // Open feedback modal for blog-level feedback
    setFeedbackModal({ postId: data.id, open: true });
  };

  const [feedbackModal, setFeedbackModal] = useState<{ postId: string; open: boolean }>({ postId: "", open: false });

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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
            <div className="prose prose-lg mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            
            {/* Top Engagement Counts Only */}
            <div className="p-4 sm:p-6 bg-muted/30 rounded-2xl mb-6">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
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

            {/* Content Sections */}
            {contentSections.map((section, index) => {
              if (section.type === 'media') {
                // Standalone media cards
                return (
                  <CollapsibleCard
                    key={index}
                    title={section.mediaType === 'youtube' ? "YouTube Video" : 
                           section.mediaType === 'vimeo' ? "Vimeo Video" :
                           section.mediaType === 'audio' ? "Audio Content" :
                           section.mediaType === 'pdf' ? "PDF Document" : "Media Content"}
                    titleIcon={section.mediaType === 'youtube' || section.mediaType === 'vimeo' ? 
                              <Play className="h-4 w-4 text-primary" /> :
                              section.mediaType === 'pdf' ? 
                              <FileText className="h-4 w-4 text-primary" /> :
                              <Image className="h-4 w-4 text-primary" />}
                    className="transition-all duration-300 ease-in-out"
                    defaultOpen={true}
                  >
                    <div dangerouslySetInnerHTML={{ __html: section.content }} />
                  </CollapsibleCard>
                );
              }
              
              // Text sections
              return (
                <CollapsibleCard
                  key={index}
                  title={section.title || `Section ${index + 1}`}
                  className="transition-all duration-300 ease-in-out"
                  defaultOpen={index === 0} // First section open by default
                >
                  <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: section.content }} />
                </CollapsibleCard>
              );
            })}
            
            {/* Fallback if no sections */}
            {contentSections.length === 0 && (
              <CollapsibleCard
                title="Article Content"
                className="transition-all duration-300 ease-in-out"
                defaultOpen={true}
              >
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="text-muted-foreground">Content is being processed...</p>
                </div>
              </CollapsibleCard>
            )}
            
            </div> {/* Close prose container */}

            {/* Bottom Engagement Actions */}
            <div className="mt-8 p-4 sm:p-6 bg-muted/30 rounded-2xl max-w-3xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLikeBlog}
                    className="h-8 px-3 transition-all duration-200 hover:scale-105 hover:bg-green-500/10 hover:text-green-600"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Like
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDislikeBlog}
                    className="h-8 px-3 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-600"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Dislike
                  </Button>
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

            {/* Author Card */}
            <section className="mt-8 space-y-4 max-w-3xl mx-auto">
              <AuthorCard
                id={p.author.id}
                name={authorProfile?.full_name || p.author.name}
                avatar={authorProfile?.avatar_url || p.author.avatar}
                title={authorProfile?.title}
                bio={authorProfile?.bio}
                specialty={authorProfile?.specialty}
                onClick={(id) => navigate(`/profile/${id}`)}
                className="rounded-2xl shadow p-6"
              />
              
              {/* Reviewer Attribution */}
              {data.reviewer && (
                <AuthorCard
                  id={data.reviewer.id}
                  name={reviewerProfile?.full_name || data.reviewer.name}
                  avatar={reviewerProfile?.avatar_url || data.reviewer.avatar}
                  title={reviewerProfile?.title}
                  bio={reviewerProfile?.bio}
                  specialty={reviewerProfile?.specialty}
                  role="reviewer"
                  onClick={(id) => navigate(`/profile/${id}`)}
                  className="rounded-2xl shadow p-6"
                />
              )}
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
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        const el = document.getElementById('comments');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="transition-all duration-200 hover:scale-105 hover:bg-accent/60"
                    >
                      Comment
                    </Button>
                    <ShareButtons title={p.title} url={window.location.href} text={p.excerpt || ""} size="sm" />
                  </div>
        </div>
      </div>
    </main>
  );
}