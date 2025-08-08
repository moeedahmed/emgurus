import { useEffect, useMemo, useState } from "react";
import { listBlogs } from "@/lib/blogsApi";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthorChip from "@/components/blogs/AuthorChip";
import ReactionBar from "@/components/blogs/ReactionBar";
import { toast } from "sonner";

export default function Blogs() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";
  const tag = searchParams.get("tag") || "";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    setSearchParams(next);
  };

  useEffect(() => {
    document.title = "Blogs | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Evidence-based articles, exam guidance, and clinical pearls.");
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await listBlogs({ status: "published", q, category: category || undefined, tag: tag || undefined, page_size: 50 });
        setItems(res.items || []);
      } catch (e: any) {
        toast.error(e.message || "Failed to load blogs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [q, category, tag]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = it.category?.title || "General";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([title, count]) => ({ title, count }));
  }, [items]);

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) for (const t of it.tags || []) map.set(t.slug || t.title, (map.get(t.slug || t.title) || 0) + 1);
    return Array.from(map.entries()).map(([slug, count]) => ({ slug, count })).slice(0, 12);
  }, [items]);

  const filtered = useMemo(() => {
    let arr = [...items];
    if (q) {
      const s = q.toLowerCase();
      arr = arr.filter((i) => i.title.toLowerCase().includes(s) || (i.excerpt || "").toLowerCase().includes(s));
    }
    if (category) arr = arr.filter((i) => (i.category?.title || "General") === category);
    if (tag) arr = arr.filter((i) => (i.tags || []).some((t: any) => (t.slug || t.title) === tag));
    switch (sort) {
      case "liked":
        arr.sort((a, b) => (b.counts?.likes || 0) - (a.counts?.likes || 0));
        break;
      case "discussed":
        arr.sort((a, b) => (b.counts?.comments || 0) - (a.counts?.comments || 0));
        break;
      default:
        arr.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
    }
    return arr;
  }, [items, q, category, tag, sort]);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <h1 className="sr-only">EMGurus Blogs — Clinical Education and Exam Guidance</h1>
      {/* Left filters */}
      <aside className="lg:col-span-3 space-y-6">
        <div>
          <label className="text-sm text-muted-foreground">Search</label>
          <Input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Search title or excerpt" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Category</label>
          <Select value={category} onValueChange={(v) => setParam("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.title} value={c.title}>{c.title} ({c.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">Popular tags</div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button key={t.slug} onClick={() => setParam("tag", t.slug === tag ? "" : t.slug)} className={`px-2 py-1 rounded-full border ${t.slug === tag ? "bg-accent" : ""}`}>
                #{t.slug} ({t.count})
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Sort</label>
          <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="liked">Most Liked</SelectItem>
              <SelectItem value="discussed">Most Discussed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </aside>

      {/* Main grid */}
      <section className="lg:col-span-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-72 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <Card className="p-6 col-span-full">No posts yet. Check back soon.</Card>
          ) : (
            filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden group cursor-pointer" onClick={() => navigate(`/blogs/${p.slug}`)}>
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={`${p.title} cover image`} className="w-full aspect-video object-cover" loading="lazy" />
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.category?.title && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.category.title}</span>}
                    {(p.tags || []).slice(0, 2).map((t: any) => (
                      <span key={t.slug} className="text-xs px-2 py-0.5 rounded-full border">#{t.slug}</span>
                    ))}
                  </div>
                  <h3 className="font-semibold line-clamp-2 story-link">{p.title}</h3>
                  {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <AuthorChip id={p.author.id} name={p.author.name} avatar={p.author.avatar} onClick={(id) => navigate(`/profile/${id}`)} />
                    <ReactionBar postId={p.id} counts={{ likes: p.counts?.likes || 0 }} compact />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Right sidebar */}
      <aside className="lg:col-span-3 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Featured</h3>
          <div className="space-y-3">
            {items.slice(0,3).map((p) => (
              <button key={p.id} onClick={() => navigate(`/blogs/${p.slug}`)} className="block text-left">
                <div className="font-medium line-clamp-1">{p.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{p.excerpt || ""}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Editor’s Picks</h3>
          <div className="space-y-3">
            {items.filter((p) => (p.tags||[]).some((t:any)=>/pick/i.test(t.title))).slice(0,3).map((p) => (
              <button key={p.id} onClick={() => navigate(`/blogs/${p.slug}`)} className="block text-left">
                <div className="font-medium line-clamp-1">{p.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{p.excerpt || ""}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <link rel="canonical" href={`${window.location.origin}/blogs`} />
    </main>
  );
}
