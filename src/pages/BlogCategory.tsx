import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ThumbsUp, Search } from "lucide-react";

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

const BlogCategory = () => {
  const { tag: rawTag } = useParams();
  const tag = decodeURIComponent(rawTag || '');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = Number(searchParams.get('page') || '1');

  useEffect(() => {
    document.title = `${tag} Articles | EMGurus Blog`;
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", `Articles tagged with ${tag} on EMGurus.`);
  }, [tag]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id,title,description,cover_image_url,created_at,slug,tags,author_id,view_count,likes_count')
        .eq('status', 'published')
        .contains('tags', [tag])
        .order('created_at', { ascending: false });
      if (!error) setPosts((data as any) || []);
      setLoading(false);
    };
    load();
  }, [tag]);

  const filtered = useMemo(() => {
    if (!q) return posts;
    const query = q.toLowerCase();
    return posts.filter(p =>
      p.title.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
  }, [posts, q]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tag}</h1>
          <p className="text-sm text-muted-foreground">Showing {perPage} posts per page</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/blog">← Back to Blog</Link>
        </Button>
      </header>

      <div className="mb-6 relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search in category"
          placeholder="Search in this category..."
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          className="pl-9"
        />
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
                <img src={p.cover_image_url} alt={`Cover image for ${p.title}`} className="w-full h-40 object-cover" loading="lazy" />
              )}
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                  {(p.tags || [tag]).slice(0, 3).map((t) => (
                    <Link key={t} to={`/blog/category/${encodeURIComponent(t)}`}>
                      <Badge variant="secondary" className="cursor-pointer">{t}</Badge>
                    </Link>
                  ))}
                </div>
                <h3 className="text-lg font-semibold mb-1 line-clamp-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{p.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.view_count ?? 0}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{p.likes_count ?? 0}</span>
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

      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Prev</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))}>Next</Button>
        </div>
      )}

      <link rel="canonical" href={`${window.location.origin}/blog/category/${encodeURIComponent(tag)}`} />
    </main>
  );
};

export default BlogCategory;
