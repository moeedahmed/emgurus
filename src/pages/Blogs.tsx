import { useEffect, useMemo, useState } from "react";
import { listBlogs } from "@/lib/blogsApi";
import { getJson } from "@/lib/functionsClient";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import BlogCard from "@/components/blogs/BlogCard";
import BlogsFilterPanel from "@/components/blogs/BlogsFilterPanel";
import TopAuthorsPanel from "@/components/blogs/TopAuthorsPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import PageHero from "@/components/PageHero";
import { CATEGORIES, sanitizeCategory } from "@/lib/taxonomy";

export default function Blogs() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const author = searchParams.get("author") || "";
  const sort = searchParams.get("sort") || "newest";
  const tag = searchParams.get("tag") || "";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    setSearchParams(next);
  };

  const toggleParam = (k: string, v: string) => {
    const cur = searchParams.get(k) || "";
    setParam(k, cur === v ? "" : v);
  };
  useEffect(() => {
    document.title = "Blogs | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Evidence-based articles, exam guidance, and clinical pearls.");
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", `${window.location.origin}/blogs`);
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        try {
          const res = await getJson('/public-blogs');
          const mapped = (res.items || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt ?? null,
            cover_image_url: p.cover_image_url ?? null,
            category: null,
            tags: [],
            author: { id: p.author_id || '', name: 'Author', avatar: null },
            reading_minutes: null,
            published_at: p.created_at ?? null,
            counts: { likes: 0, comments: 0, views: 0 },
          }));
          setItems(mapped);
        } catch {
          const res = await listBlogs({ status: "published", q, category: category || undefined, page_size: 50 });
          setItems(res.items || []);
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load blogs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [q, category]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    // seed with our canonical taxonomy so UI stays consistent
    for (const c of CATEGORIES) map.set(c, 0);
    for (const it of items) {
      const key = sanitizeCategory(it.category?.title || "General");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return CATEGORIES.map((title) => ({ title, count: map.get(title) || 0 }));
  }, [items]);

  const authors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const it of items) {
      const id = it.author?.id;
      const name = it.author?.name;
      if (!id || !name) continue;
      const cur = map.get(id) || { id, name, count: 0 };
      cur.count += 1;
      map.set(id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  const topAuthors = useMemo(() => {
    const stats = new Map<string, { id: string; name: string; avatar: string | null; posts: number; views: number; likes: number; lastDate: number }>();
    for (const it of items) {
      const id = it.author?.id;
      if (!id) continue;
      const s = stats.get(id) || { id, name: it.author.name, avatar: it.author.avatar || null, posts: 0, views: 0, likes: 0, lastDate: 0 };
      s.posts += 1;
      s.views += it.counts?.views || 0;
      s.likes += it.counts?.likes || 0;
      const d = new Date(it.published_at || it.created_at || 0).getTime();
      if (d > s.lastDate) s.lastDate = d;
      stats.set(id, s);
    }
    const now = Date.now();
    return Array.from(stats.values())
      .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, posts: s.posts, views: s.views, likes: s.likes, online: now - s.lastDate < 7 * 24 * 60 * 60 * 1000 }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);
  }, [items]);


  const filtered = useMemo(() => {
    let arr = [...items];
    if (q) {
      const s = q.toLowerCase();
      arr = arr.filter((i) => i.title.toLowerCase().includes(s) || (i.excerpt || "").toLowerCase().includes(s));
    }
    if (category) arr = arr.filter((i) => (i.category?.title || "General") === category);
    if (author) arr = arr.filter((i) => (i.author?.id || "") === author);
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
  }, [items, q, category, sort, tag]);
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
    <main>
      <PageHero
        title="EMGurus Blogs"
        subtitle="Evidence-based articles, exam guidance, and clinical pearls."
        align="center"
        ctas={[{ label: "Write Blog", href: "/blogs/editor/new", variant: "default" }]}
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left filters panel - sticky and independently scrollable */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="lg:sticky lg:top-20">
              <div className="max-h-[calc(100vh-6rem)] overflow-auto pr-2 space-y-6">
                <BlogsFilterPanel
                  q={q}
                  category={category}
                  author={author}
                  sort={sort}
                  categories={categories}
                  authors={authors}
                  onChange={setParam}
                  onReset={() => setSearchParams(new URLSearchParams())}
                />
                <TopAuthorsPanel authors={topAuthors} />
              </div>
            </div>
          </aside>

          {/* Main list - vertical cards, left aligned */}
          <section className="lg:col-span-8">
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-3 lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Filters</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 sm:w-96">
                    <BlogsFilterPanel
                      q={q}
                      category={category}
                      author={author}
                      sort={sort}
                      categories={categories}
                      authors={authors}
                      onChange={setParam}
                      onReset={() => setSearchParams(new URLSearchParams())}
                    />
                  </SheetContent>
                </Sheet>
              </div>
              {/* Active filters row */}
              {(category || tag || author || sort !== 'newest') && (
                <div className="flex flex-wrap items-center gap-2">
                  {category && (
                    <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setParam('category','')}>Category: {category} ×</Button>
                  )}
                  {tag && (
                    <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setParam('tag','')}>Tag: {tag} ×</Button>
                  )}
                  {author && (
                    <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setParam('author','')}>Author ×</Button>
                  )}
                  {sort !== 'newest' && (
                    <Button size="sm" variant="secondary" aria-pressed className="rounded-full" onClick={() => setParam('sort','newest')}>
                      Sort: {sort === 'liked' ? 'Most Liked' : sort === 'discussed' ? 'Most Discussed' : sort === 'editors' ? "Editor's Picks" : sort === 'featured' ? 'Featured' : 'Newest'} ×
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSearchParams(new URLSearchParams())}>Clear all</Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{filtered.length} posts</div>
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
                  selectedCategory={category}
                  selectedTag={tag}
                  onTagClick={(type, value) => {
                    if (type === 'category') toggleParam('category', value);
                    if (type === 'tag') {
                      if (value === 'most-liked') setParam('sort', sort === 'liked' ? 'newest' : 'liked');
                      else toggleParam('tag', value);
                    }
                  }}
                />
                ))
              )}
              {/* Mobile: Top authors below the list */}
              <div className="lg:hidden">
                <TopAuthorsPanel authors={topAuthors} />
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}