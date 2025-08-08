import { useEffect, useMemo, useState } from "react";
import { listBlogs } from "@/lib/blogsApi";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import BlogCard from "@/components/blogs/BlogCard";
import BlogsFilterPanel from "@/components/blogs/BlogsFilterPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";


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
      case "editors":
        arr = arr.filter((i) => (i.tags || []).some((t: any) => /editor|pick/i.test(t.slug || t.title)));
        break;
      case "featured":
        arr = arr.filter((i) => (i.tags || []).some((t: any) => /featured|star|top/i.test(t.slug || t.title)) || /featured/i.test(i.category?.title || ""));
        break;
      default:
        arr.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
    }
    return arr;
  }, [items, q, category, tag, sort]);

  const topByCat = useMemo(() => {
    const byCat = new Map<string, any[]>();
    for (const it of filtered) {
      const key = it.category?.title || "General";
      const arr = byCat.get(key) || [];
      arr.push(it);
      byCat.set(key, arr);
    }
    const top = new Set<string>();
    for (const [, arr] of byCat) {
      arr.sort((a, b) => (b.counts?.likes || 0) - (a.counts?.likes || 0));
      for (const it of arr.slice(0, 3)) top.add(it.id);
    }
    return top;
  }, [filtered]);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="sr-only">EMGurus Blogs — Clinical Education and Exam Guidance</h1>

      <nav className="mb-4 text-sm text-muted-foreground">
        <button className="hover:underline" onClick={() => navigate('/')}>Home</button>
        <span className="mx-2">›</span>
        <span className="text-foreground">Blogs</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main list - vertical cards, left aligned */}
        <section className="lg:col-span-8">
          <div className="mb-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Filters</Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 sm:w-96">
                <BlogsFilterPanel
                  q={q}
                  category={category}
                  sort={sort}
                  tag={tag}
                  categories={categories}
                  tags={tags}
                  onChange={setParam}
                />
              </SheetContent>
            </Sheet>
          </div>
          <div className="space-y-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-72 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <Card className="p-6">No posts yet. Check back soon.</Card>
            ) : (
              filtered.map((p) => (
                <BlogCard
                  key={p.id}
                  post={p}
                  onOpen={() => navigate(`/blogs/${p.slug}`)}
                  topBadge={topByCat.has(p.id) ? { label: 'Most Liked' } : null}
                />
              ))
            )}
          </div>
        </section>

        {/* Right filters panel - sticky and independently scrollable */}
        <aside className="lg:col-span-4 hidden lg:block">
          <div className="lg:sticky lg:top-20">
            <div className="max-h-[calc(100vh-6rem)] overflow-auto pr-2">
              <BlogsFilterPanel
                q={q}
                category={category}
                sort={sort}
                tag={tag}
                categories={categories}
                tags={tags}
                onChange={setParam}
              />
            </div>
          </div>
        </aside>
      </div>
      <link rel="canonical" href={`${window.location.origin}/blogs`} />
    </main>
  );
}
