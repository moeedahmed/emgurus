import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthorChip from "@/components/blogs/AuthorChip";

interface FeaturedBlogHeroProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    cover_image_url?: string | null;
    category?: { title?: string | null } | null;
    tags?: { slug?: string; title?: string }[];
    author?: { id: string; name: string; avatar?: string | null };
    published_at?: string | null;
  };
}

export default function FeaturedBlogHero({ post }: FeaturedBlogHeroProps) {
  const isFeatured = (post.tags || []).some((t) => /featured|editor|pick|star|top/i.test((t.slug || t.title || "")));
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
  return (
    <section className="relative mb-8">
      <div className="relative overflow-hidden rounded-2xl border">
        <img
          src={post.cover_image_url || "/placeholder.svg"}
          alt={`${post.title} cover image`}
          className="w-full h-[260px] sm:h-[360px] lg:h-[420px] object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8 text-foreground">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {isFeatured && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">Featured</span>
            )}
            {post.category?.title && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {post.category.title}
              </span>
            )}
            {date && <span className="text-xs text-muted-foreground">{date}</span>}
          </div>
          <h2 className="heading-lg max-w-3xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mt-2 max-w-2xl line-clamp-2 text-sm sm:text-base text-muted-foreground">
              {post.excerpt}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {post.author && (
              <AuthorChip id={post.author.id} name={post.author.name} avatar={post.author.avatar || null} />
            )}
            <Button asChild size="sm" variant="secondary" className="ml-auto">
              <Link to={`/blogs/${post.slug}`}>Read Article</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
