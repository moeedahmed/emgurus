import AuthorChip from "@/components/blogs/AuthorChip";
import ReactionBar from "@/components/blogs/ReactionBar";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BlogCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    category: { title?: string; slug?: string } | null;
    tags: { slug: string; title: string }[];
    author: { id: string; name: string; avatar: string | null };
    published_at: string | null;
    counts: { likes: number; comments?: number; views?: number };
  };
  topBadge?: { label: string } | null;
  onOpen?: () => void;
}

export default function BlogCard({ post: p, topBadge, onOpen }: BlogCardProps) {
  const words = (p.excerpt || "").split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.ceil(words / 220));
  const summary = p.excerpt || "Summary not available yet.";

  return (
    <Card
      className="overflow-hidden group cursor-pointer transition-shadow hover:shadow-md relative"
      onClick={onOpen}
      aria-label={`Open blog post ${p.title}`}
    >
      {p.cover_image_url && (
        <div className="relative">
          <img
            src={p.cover_image_url}
            alt={`${p.title} cover image`}
            className="w-full aspect-video object-cover"
            loading="lazy"
            decoding="async"
          />
          {topBadge?.label && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-primary/90 text-primary-foreground shadow">
                    🏅 {topBadge.label}
                  </div>
                </TooltipTrigger>
                <TooltipContent>Top ranked in category</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {p.category?.title && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {p.category.title}
            </span>
          )}
          {(p.tags || []).slice(0, 3).map((t) => (
            <span key={t.slug || t.title} className="text-xs px-2 py-0.5 rounded-full border">
              #{t.slug || t.title}
            </span>
          ))}
        </div>

        <h3 className="font-semibold text-lg line-clamp-2 story-link">{p.title}</h3>
        {summary && <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <AuthorChip id={p.author.id} name={p.author.name} avatar={p.author.avatar} />
            <span className="text-xs text-muted-foreground">
              {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
              {words ? ` · ${readMin} min read` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ReactionBar postId={p.id} counts={{ likes: p.counts?.likes || 0 }} />
            <span>{p.counts?.views || 0} views</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
