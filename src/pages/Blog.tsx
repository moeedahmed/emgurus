import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Pencil, Search, ThumbsUp, Eye, Star } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import fallbackCover from "@/assets/medical-blog.jpg";

interface PostItem {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  slug: string | null;
  tags: string[] | null;
  author_id: string;
  view_count?: number | null;
  likes_count?: number | null;
}

const perPage = 9;

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

const Blog = () => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = Number(searchParams.get('page') || '1');
  const tag = searchParams.get('tag') || '';
  const sort = searchParams.get('sort') || 'popular';
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "EMGurus Blog | Medical Insights";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "EMGurus blog with peer-reviewed medical articles and updates.");
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id,title,description,cover_image_url,created_at,slug,tags,author_id,view_count,likes_count")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setPosts((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchLikes = async () => {
      if (!user) { setLikedIds(new Set()); return; }
      const { data, error } = await supabase.from('blog_likes').select('post_id');
      if (!error && Array.isArray(data)) {
        setLikedIds(new Set((data as any[]).map((r: any) => r.post_id)));
      }
    };
    fetchLikes();
  }, [user?.id, posts.length]);

  const filtered = useMemo(() => {
    let r = posts;
    if (q) {
      const query = q.toLowerCase();
      r = r.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        (p.tags || []).some(t => t.toLowerCase().includes(query))
      );
    }
    if (tag) {
      r = r.filter(p => (p.tags || []).includes(tag));
    }
    return r;
  }, [posts, q, tag]);

  const featured = filtered.slice(0, 3);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };


  const sortedPrimary = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'new':
        return arr.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'old':
        return arr.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'liked':
        return arr.sort((a,b) => (b.likes_count ?? 0) - (a.likes_count ?? 0) || (b.view_count ?? 0) - (a.view_count ?? 0));
      default:
        return arr.sort((a,b) => (b.view_count ?? 0) - (a.view_count ?? 0) || (b.likes_count ?? 0) - (a.likes_count ?? 0));
    }
  }, [filtered, sort]);
  const paginatedMain = sortedPrimary.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(sortedPrimary.length / perPage));
  const featuredIds = useMemo(() => new Set(featured.map(p => p.id)), [featured]);
  const isEditorPick = (p: PostItem) => featuredIds.has(p.id) || (p.tags || []).some(t => /editor'?s pick/i.test(t) || /featured/i.test(t));

  const addSamples = async () => {
    try {
      if (!user) {
        toast.error("Sign in to add sample posts");
        return;
      }
      const samples = [
        {
          title: "Managing Sepsis in the ED: A Practical Guide",
          description: "Recognition, resuscitation, and rapid antibiotic strategies for sepsis in the emergency department.",
          cover: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1600&auto=format&fit=crop",
          tags: ["Emergency Medicine", "Sepsis", "Critical Care"],
          content: `
            <h2>Overview</h2>
            <p>Sepsis remains a leading cause of mortality. Early recognition and timely management save lives.</p>
            <h3>Key Steps</h3>
            <ul>
              <li>Recognize red flags (hypotension, altered mentation).</li>
              <li>Start broad-spectrum antibiotics within 60 minutes.</li>
              <li>Resuscitate with 30 mL/kg crystalloid, reassess.</li>
            </ul>
            <blockquote>“Treat sepsis like a time-critical condition.”</blockquote>
            <p>Use bedside ultrasound to guide fluid responsiveness and identify sources.</p>
          `,
        },
        {
          title: "Airway Pearls: Intubation Tips for Difficult Cases",
          description: "From positioning to preoxygenation—practical pearls for your next challenging airway.",
          cover: "https://images.unsplash.com/photo-1504439904031-93ded9f93e3f?q=80&w=1600&auto=format&fit=crop",
          tags: ["Airway", "Procedures", "Education"],
          content: `
            <h2>Preparation</h2>
            <p>Positioning and preoxygenation are everything. Optimize before you touch the laryngoscope.</p>
            <h3>Checklist</h3>
            <ol>
              <li>Plan A/B/C with your team.</li>
              <li>Use ramped position for obese patients.</li>
              <li>Consider awake intubation when appropriate.</li>
            </ol>
            <p>Video laryngoscopy can improve first-pass success in many scenarios.</p>
          `,
        },
        {
          title: "ECG Mastery: Recognizing STEMI Mimics",
          description: "Don’t miss the dangerous mimics—hyperkalemia, pericarditis, LV aneurysm and more.",
          cover: "https://images.unsplash.com/photo-1516542076529-1ea3854896e1?q=80&w=1600&auto=format&fit=crop",
          tags: ["ECG", "Cardiology", "Diagnostics"],
          content: `
            <h2>Common Mimics</h2>
            <p>Several conditions present with ST-elevation patterns. Context is crucial.</p>
            <table>
              <thead><tr><th>Condition</th><th>Clues</th></tr></thead>
              <tbody>
                <tr><td>Pericarditis</td><td>Diffuse ST elevation, PR depression</td></tr>
                <tr><td>Hyperkalemia</td><td>Tall peaked T waves</td></tr>
                <tr><td>LV Aneurysm</td><td>Persistent ST elevation post-MI</td></tr>
              </tbody>
            </table>
            <p>Always correlate with symptoms, troponins, and bedside echo.</p>
          `,
        },
        {
          title: "Head CT in Minor Head Injury: When to Scan",
          description: "Applying decision rules to reduce unnecessary radiology without missing danger.",
          cover: "https://images.unsplash.com/photo-1581594549595-35f6ed5b8f5c?q=80&w=1600&auto=format&fit=crop",
          tags: ["Imaging", "Neurology", "Evidence"],
          content: `
            <p>Use validated tools like the Canadian CT Head Rule to guide decisions.</p>
            <ul>
              <li>Assess GCS, vomiting, age, and mechanism.</li>
              <li>Shared decision-making reduces utilization.</li>
            </ul>
          `,
        },
        {
          title: "Antibiotics in Cellulitis: What, When, and How Long",
          description: "Choosing agents and durations that balance efficacy with stewardship.",
          cover: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?q=80&w=1600&auto=format&fit=crop",
          tags: ["Infectious Disease", "Antibiotics", "Dermatology"],
          content: `
            <p>Empiric coverage should target streptococci; add MRSA coverage when risk factors exist.</p>
          `,
        },
        {
          title: "Pediatric Fever: Red Flags You Can't Miss",
          description: "Ages, appearance, and vitals that change the game in febrile children.",
          cover: "https://images.unsplash.com/photo-1600959907703-125ba1374a12?q=80&w=1600&auto=format&fit=crop",
          tags: ["Pediatrics", "Fever", "Triage"],
          content: `
            <p>Ill appearance and poor perfusion trump temperature alone. Trust your gestalt.</p>
          `,
        },
        {
          title: "Stroke Thrombolysis: Door-to-Needle Done Right",
          description: "Streamlining workflows for faster, safer stroke care in the ED.",
          cover: "https://images.unsplash.com/photo-1559757175-08d1ea6a9d26?q=80&w=1600&auto=format&fit=crop",
          tags: ["Neurology", "Stroke", "Systems"],
          content: `
            <p>Pre-notification, parallel processing, and checklists shave precious minutes.</p>
          `,
        },
        {
          title: "Point-of-Care Ultrasound: FAST Exam Essentials",
          description: "Focused assessment in trauma—views, pitfalls, and pearls.",
          cover: "https://images.unsplash.com/photo-1580281657520-4e4b3c7539e2?q=80&w=1600&auto=format&fit=crop",
          tags: ["Ultrasound", "Trauma", "Critical Care"],
          content: `
            <p>FAST rapidly detects free fluid; integrate with clinical picture and vitals.</p>
          `,
        },
        {
          title: "Procedural Sedation: Safety and Success",
          description: "Dosing, monitoring, and airway backup for common ED procedures.",
          cover: "https://images.unsplash.com/photo-1584982896647-33b3790fb70b?q=80&w=1600&auto=format&fit=crop",
          tags: ["Sedation", "Procedures", "Safety"],
          content: `
            <p>Use capnography and pre-oxygenation; match agent selection to the procedure and patient.</p>
          `,
        },
        {
          title: "Chest Pain Pathways: Low-Risk Doesn’t Mean No-Risk",
          description: "Troponins, HEART score, and discharge safety nets for low-risk chest pain.",
          cover: "https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?q=80&w=1600&auto=format&fit=crop",
          tags: ["Cardiology", "Chest Pain", "Guidelines"],
          content: `
            <p>Serial troponins and structured risk tools reduce admissions while maintaining safety.</p>
          `,
        },
      ];

      const now = new Date().toISOString();
      const rows = samples.map((s) => ({
        title: s.title,
        description: s.description,
        cover_image_url: s.cover,
        content: s.content,
        status: "published" as const,
        slug: s.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-"),
        author_id: user.id,
        tags: s.tags,
        created_at: now,
      }));
      const { error } = await supabase.from("blog_posts").insert(rows as any);
      if (error) throw error;
      toast.success("Sample posts added");
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,description,cover_image_url,created_at,slug,tags,author_id")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      setPosts((data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to add sample posts");
    }
  };

  const recordView = async (postId: string) => {
    try {
      const { data } = await supabase.functions.invoke('blog-record-view', { body: { post_id: postId } });
      if (data && typeof data.view_count === 'number') {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, view_count: data.view_count } : p));
      }
    } catch {}
  };

  const toggleLike = async (postId: string) => {
    if (!user) { toast.error('Sign in to like'); return; }
    const { data, error } = await supabase.functions.invoke('blog-toggle-like', { body: { post_id: postId } });
    if (!error && data) {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (data.liked) next.add(postId); else next.delete(postId);
        return next;
      });
      if (typeof data.likes_count === 'number') {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: data.likes_count } : p));
      }
    }
  };

  useEffect(() => {
    if (loading || !user) return;
    try {
      if (localStorage.getItem('seeded_demo_posts')) return;
    } catch {}
    const haveCovers = posts.filter(p => !!p.cover_image_url).length;
    if (posts.length < 6 || haveCovers < 3) {
      addSamples().then(() => {
        try { localStorage.setItem('seeded_demo_posts', '1'); } catch {}
      });
    }
  }, [loading, user?.id, posts.length]);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="sr-only">EMGurus Blog — Medical Education Articles</h1>

      {/* Top bar: search + Write Blog */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search articles"
            placeholder="Search articles, tags..."
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            className="pl-9"
          />
        </div>
        {user && (
          <Button onClick={() => navigate('/editor')} aria-label="Write a new blog post">
            <Pencil className="mr-2 h-4 w-4" /> Write Blog
          </Button>
        )}
      </div>

      {/* Featured section */}
      {loading ? (
            <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        featured.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Featured</h2>
            <div className="grid grid-cols-1 gap-6">
              {featured.map((p) => (
                <Card key={p.id} className="relative overflow-hidden group cursor-pointer" onClick={() => { if (p.slug) { recordView(p.id); navigate(`/blog/${p.slug}`); }}} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && p.slug) { recordView(p.id); navigate(`/blog/${p.slug}`); } }}>
                  {isEditorPick(p) && (
                    <div className="absolute right-2 top-2 z-10 rounded-full bg-background/80 px-2 py-1 shadow-sm">
                      <span className="inline-flex items-center gap-1 text-xs text-primary"><Star className="h-3.5 w-3.5" fill="currentColor" /> Pick</span>
                    </div>
                  )}
                  <img
                    src={p.cover_image_url || fallbackCover}
                    alt={`Cover image for ${p.title}`}
                    className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackCover; }}
                  />
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {(p.tags || ["General"]).slice(0, 3).map((t) => (
                        <Link key={t} to={`/blog/category/${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className="cursor-pointer">{t}</Badge>
                        </Link>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.view_count ?? 0}</span>
                      <button className={`inline-flex items-center gap-1 transition-opacity ${likedIds.has(p.id) ? 'text-primary' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }} aria-pressed={likedIds.has(p.id)} aria-label="Like this article">
                        <ThumbsUp className="h-3.5 w-3.5" />{p.likes_count ?? 0}
                      </button>
                      <span>{readTime(p.description || '')} min read</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(9)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedMain.map((p) => (
                <Card key={p.id} className="relative overflow-hidden cursor-pointer" onClick={() => { if (p.slug) { recordView(p.id); navigate(`/blog/${p.slug}`); }}} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && p.slug) { recordView(p.id); navigate(`/blog/${p.slug}`); } }}>
                  {isEditorPick(p) && (
                    <div className="absolute right-2 top-2 z-10 rounded-full bg-background/80 px-2 py-1 shadow-sm">
                      <span className="inline-flex items-center gap-1 text-xs text-primary"><Star className="h-3.5 w-3.5" fill="currentColor" /> Pick</span>
                    </div>
                  )}
                  <img
                    src={p.cover_image_url || fallbackCover}
                    alt={`Cover image for ${p.title}`}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackCover; }}
                  />
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {(p.tags || ["General"]).slice(0, 3).map((t) => (
                        <Link key={t} to={`/blog/category/${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className="cursor-pointer">{t}</Badge>
                        </Link>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.view_count ?? 0}</span>
                      <button className={`inline-flex items-center gap-1 transition-opacity ${likedIds.has(p.id) ? 'text-primary' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }} aria-pressed={likedIds.has(p.id)} aria-label="Like this article">
                        <ThumbsUp className="h-3.5 w-3.5" />{p.likes_count ?? 0}
                      </button>
                      <span>{readTime(p.description || '')} min read</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Prev</Button>
              <span className="text-sm text-muted-foreground">Showing {sortedPrimary.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, sortedPrimary.length)} of {sortedPrimary.length} • {perPage} per page</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))}>Next</Button>
            </div>
          )}

          {posts.length === 0 && !loading && (
            <Card className="p-6 mt-6">
              <div className="flex items-center justify-between gap-4">
                <span>No articles yet. Gurus can publish from the Review page.</span>
                {user && (
                  <Button onClick={addSamples}>Add sample posts</Button>
                )}
              </div>
            </Card>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Sort By</h3>
            <RadioGroup value={sort} onValueChange={(v) => setParam('sort', v)} className="grid gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="sort-new" />
                <Label htmlFor="sort-new">Newest First</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="old" id="sort-old" />
                <Label htmlFor="sort-old">Oldest First</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="popular" id="sort-popular" />
                <Label htmlFor="sort-popular">Most Popular</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="liked" id="sort-liked" />
                <Label htmlFor="sort-liked">Most Liked</Label>
              </div>
            </RadioGroup>
          </Card>
        </aside>
      </div>

      {/* Mobile FAB */}
      {user && (
        <Button onClick={() => navigate('/editor')} className="fixed md:hidden bottom-20 right-6 rounded-full h-12 w-12 shadow-lg" aria-label="Write a new blog">
          <Pencil className="h-5 w-5" />
        </Button>
      )}

      <link rel="canonical" href={`${window.location.origin}/blog`} />
    </main>
  );
};

export default Blog;
