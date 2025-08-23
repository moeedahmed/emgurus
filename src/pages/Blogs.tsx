import { useEffect, useMemo, useState } from "react";
import { listBlogs } from "@/lib/blogsApi";
import { getJson } from "@/lib/functionsClient";
import { callFunction } from "@/lib/functionsUrl";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
import { Chip } from "@/components/ui/chip";
import FeaturedBlogCarousel from "@/components/blogs/FeaturedBlogCarousel";

export default function Blogs({ embedded = false }: { embedded?: boolean } = {}) {
  const [items, setItems] = useState<any[]>([]);
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, page_size: 12, total: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const author = searchParams.get("author") || "";
  const sort = searchParams.get("sort") || "newest";
  const tag = searchParams.get("tag") || "";
  const page = Number(searchParams.get("page") || 1);

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
    // Set page title and meta description
    document.title = "Blogs – EMGurus";
    const description = "Explore the latest medical learning blogs from EMGurus.";
    
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
      { property: "og:title", content: "Blogs – EMGurus" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${window.location.origin}/blogs` },
      { property: "og:image", content: `${window.location.origin}/assets/logo-em-gurus.png` },
      { property: "og:site_name", content: "EMGurus" }
    ];

    // Create Twitter meta tags
    const twitterTags = [
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Blogs – EMGurus" },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${window.location.origin}/assets/logo-em-gurus.png` }
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

    // Canonical link
    let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}/blogs`);

    return () => {
      // Cleanup only newly added tags
      addedTags.forEach(tag => {
        if (document.head.contains(tag)) {
          document.head.removeChild(tag);
        }
      });
      if (document.head.contains(canonical)) {
        document.head.removeChild(canonical);
      }
    };
  }, []);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load featured posts separately (only on first page with no filters)
        if (page === 1 && !q && !category && !author && !tag) {
          try {
            const featuredRes = await listBlogs({ status: "published", featured: true });
            setFeaturedItems(featuredRes.items || []);
          } catch (e) {
            console.warn("Failed to load featured posts:", e);
          }
        } else {
          setFeaturedItems([]);
        }

        // Load regular posts
        const res = await listBlogs({ 
          status: "published", 
          q: q || undefined, 
          category: category || undefined,
          author: author || undefined,
          tag: tag || undefined,
          sort: sort || undefined,
          page,
          page_size: 12
        });
        
        // Filter out featured posts from regular list to avoid duplicates
        const featuredIds = new Set(featuredItems.map(f => f.id));
        const filteredItems = (res.items || []).filter(item => !featuredIds.has(item.id));
        
        setItems(filteredItems);
        setPagination({ page: res.page, page_size: res.page_size, total: res.total });
      } catch (e: any) {
        toast.error(e.message || "Failed to load blogs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [q, category, author, tag, sort, page]);

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


  const topByCat = useMemo(() => {
    const byCat = new Map<string, any[]>();
    for (const it of items) {
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
  }, [items]);

  return (
    <main>
      {!embedded && (
        <PageHero
          title="Blogs"
          subtitle="Read and share insights from the EM community."
          align="center"
          ctas={[{ label: "Write Blog", href: "/blogs/editor/new", variant: "default" }]}
        />
      )}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
            {/* Featured posts carousel */}
            {featuredItems.length > 0 && (
              <div className="mb-8">
                <FeaturedBlogCarousel posts={featuredItems} />
              </div>
            )}
            
            
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
                    <Chip name="blogs_active_category" value={category} selected variant="solid" size="sm" onSelect={() => setParam('category','')}>
                      {category} ×
                    </Chip>
                  )}
                  {tag && (
                    <Chip name="blogs_active_tag" value={tag} selected variant="solid" size="sm" onSelect={() => setParam('tag','')}>
                      {tag} ×
                    </Chip>
                  )}
                  {author && (
                    <Chip name="blogs_active_author" value={author} selected variant="solid" size="sm" onSelect={() => setParam('author','')}>
                      {(authors.find(a => a.id === author)?.name) || 'Author'} ×
                    </Chip>
                  )}
                  {sort !== 'newest' && (
                    <Chip name="blogs_active_sort" value={sort} selected variant="solid" size="sm" onSelect={() => setParam('sort','newest')}>
                      {sort === 'liked' ? 'Most Liked' : sort === 'discussed' ? 'Most Discussed' : sort === 'editors' ? "Editor's Picks" : sort === 'featured' ? 'Featured' : 'Newest'} ×
                    </Chip>
                  )}
                  <Chip name="blogs_clear" value="clear" variant="ghost" size="sm" onSelect={() => setSearchParams(new URLSearchParams())}>Clear all</Chip>
                </div>
              )}
            </div>
            {/* Header with count */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mb-2">Blogs</h1>
              <p className="text-sm text-muted-foreground">Showing {pagination.total} posts</p>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {loading ? (
                <div className="grid gap-4 sm:gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="h-72 animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <Card className="p-6 sm:p-8 text-center">
                  <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
                  <p className="text-muted-foreground">New articles are published regularly—check back soon.</p>
                </Card>
              ) : (
                <div className="grid gap-4 sm:gap-6 max-w-4xl mx-auto">
                  {items.map((p) => (
                    <BlogCard
                      key={p.id}
                      post={p}
                      onOpen={() => navigate(`/blogs/${p.slug}`)}
                      topBadge={topByCat.has(p.id) ? { label: 'Most Liked' } : null}
                      selectedCategory={category}
                      selectedTag={tag}
                      selectedSort={sort}
                      onTagClick={(type, value) => {
                        if (type === 'category') toggleParam('category', value);
                        if (type === 'tag') {
                          if (value === 'most-liked') setParam('sort', sort === 'liked' ? 'newest' : 'liked');
                          else toggleParam('tag', value);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              {pagination.total > pagination.page_size && (
                <div className="flex justify-center py-8">
                  <Pagination>
                    <PaginationContent>
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setParam("page", String(page - 1))} />
                        </PaginationItem>
                      )}
                      {page < Math.ceil(pagination.total / pagination.page_size) && (
                        <PaginationItem>
                          <PaginationNext onClick={() => setParam("page", String(page + 1))} />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
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