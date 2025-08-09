import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import PageHero from "@/components/PageHero";

const FORUMS_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/forums-api";

interface Category { id: string; title: string; description: string | null; }

const Forums = () => {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    document.title = "Forums | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Browse EMGurus forum categories: Study Tips, EM Exams, Clinical Scenarios.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FORUMS_EDGE}/api/forum/categories`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load categories');
        setItems(data.items || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <PageHero
        title="EM Gurus Forums"
        subtitle="Discuss by topic or exam. Join the EM community."
        align="left"
        ctas={[{ label: "Start a Thread", href: "/coming-soon", variant: "outline" }]}
      />

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-6">{error}</div>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.id} to={`/forums/${c.id}`} className="block group">
              <Card className="p-6 flex flex-col border-2 transition hover:shadow-md hover:border-primary/20 rounded-xl">
                <h2 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">{c.title}</h2>
                <p className="text-muted-foreground flex-1">{c.description || 'Discussion category'}</p>
                <div className="pt-4 text-sm text-primary group-hover:underline">View threads →</div>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
};

export default Forums;
