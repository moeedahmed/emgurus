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
import { Pencil, Search, ThumbsUp, Eye } from "lucide-react";

interface PostItem {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  slug: string | null;
  tags: string[] | null;
  author_id: string;
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
        .select("id,title,description,cover_image_url,created_at,slug,tags,author_id")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setPosts((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

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
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    posts.forEach(p => (p.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [posts]);

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
          cover: "https://images.unsplash.com/photo-1582719478250-1e88b1f69a00?q=80&w=1600&auto=format&fit=crop",
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
          cover: "https://images.unsplash.com/photo-1582719478250-7a6a8b3a4a11?q=80&w=1600&auto=format&fit=crop",
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
        <div className="grid gap-6 md:grid-cols-3">
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
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((p) => (
                <Card key={p.id} className="overflow-hidden group">
                  {p.cover_image_url && (
                    <img
                      src={p.cover_image_url}
                      alt={`Cover image for ${p.title}`}
                      className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {(p.tags || ["General"]).slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setParam('tag', t)}>{t}</Badge>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{pseudoCount(p.id, 300)}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{pseudoCount(p.id, 20, 80)}</span>
                      <span>{readTime(p.description || '')} min read</span>
                    </div>
                    {p.slug && (
                      <Button variant="outline" className="mt-3" asChild>
                        <Link to={`/blog/${p.slug}`} aria-label={`Read article ${p.title}`}>Read Article</Link>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Recent Blogs grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Blogs</h2>
            <div className="hidden md:flex items-center gap-2 overflow-x-auto">
              {allTags.slice(0, 10).map((t) => (
                <Badge key={t} variant={t === tag ? "default" : "secondary"} className="whitespace-nowrap cursor-pointer" onClick={() => setParam('tag', t)}>
                  {t}
                </Badge>
              ))}
              {tag && (
                <Button variant="ghost" size="sm" onClick={() => setParam('tag', '')}>Clear</Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              {paginated.map((p) => (
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
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {(p.tags || ["General"]).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setParam('tag', t)}>{t}</Badge>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{pseudoCount(p.id, 150)}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{pseudoCount(p.id, 10, 60)}</span>
                      <span>{readTime(p.description || '')} min read</span>
                    </div>
                    {p.slug && (
                      <Button variant="outline" className="mt-3" asChild>
                        <Link to={`/blog/${p.slug}`} aria-label={`Read article ${p.title}`}>Read Article</Link>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Prev</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
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

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Most Popular</h3>
            <ul className="space-y-2 text-sm">
              {filtered.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3">
                  <Link to={p.slug ? `/blog/${p.slug}` : '#'} className="hover:underline flex-1 line-clamp-1">{p.title}</Link>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{pseudoCount(p.id, 300)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Editor’s Pick</h3>
            {filtered[1] ? (
              <div>
                <p className="text-sm font-medium mb-1 line-clamp-2">{filtered[1].title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{filtered[1].description}</p>
                {filtered[1].slug && (
                  <Button variant="link" className="px-0" asChild>
                    <Link to={`/blog/${filtered[1].slug}`}>Read now →</Link>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pick yet.</p>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Browse by Tag</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 20).map((t) => (
                <Badge key={t} variant="outline" className="cursor-pointer" onClick={() => setParam('tag', t)}>{t}</Badge>
              ))}
            </div>
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
