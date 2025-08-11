import AuthorChip from "@/components/blogs/AuthorChip";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import fallbackImage from "@/assets/medical-blog.jpg";

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
  onTagClick?: (type: 'category' | 'tag' | 'author', value: string) => void;
  selectedCategory?: string;
  selectedTag?: string;
}

export default function BlogCard({ post: p, topBadge, onOpen, onTagClick, selectedCategory, selectedTag }: BlogCardProps) {
  const cover = p.cover_image_url || fallbackImage;
  const words = (p.excerpt || "").split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.ceil(words / 220));
  const summary = p.excerpt || "Summary not available yet.";
  const badges: string[] = [];
  if ((p.counts?.likes || 0) >= 10) badges.push("Most Discussed");
  if ((p.tags || []).some((t) => /editor|pick/i.test(t.slug || t.title))) badges.push("Editor’s Pick");
  if ((p.tags || []).some((t) => /featured|star|top/i.test(t.slug || t.title))) badges.push("Featured");

  return (
    <Card
      className="overflow-hidden group cursor-pointer transition-shadow hover:shadow-md relative"
      onClick={onOpen}
      aria-label={`Open blog post ${p.title}`}
    >
      <div className="relative">
        <img
          src={cover}
          alt={`${p.title} cover image`}
          className="w-full h-32 md:h-40 object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {topBadge?.label && (
            <Badge
              variant="secondary"
  className="text-xs"
            >
              {topBadge.label}
            </Badge>
          )}
          {badges.map((b) => (
            <Badge key={b} variant="outline" className="text-xs">
              {b}
            </Badge>
          ))}
          {p.category?.title && !/^imported$/i.test(p.category.title) && (
            <Badge
              variant={selectedCategory === p.category!.title! ? "secondary" : "outline"}
              className="text-xs cursor-pointer"
              aria-pressed={selectedCategory === p.category!.title!}
              title={p.category!.title!}
              onClick={() => onTagClick?.('category', p.category!.title!)}
            >
              {p.category.title}
            </Badge>
          )}
          {(p.tags || []).slice(0, 3).map((t) => {
            const label = t.slug || t.title;
            const active = selectedTag === label;
            return (
              <Badge
                key={label}
                variant={active ? "secondary" : "outline"}
                className="text-xs cursor-pointer"
                aria-pressed={active}
                title={label}
                onClick={() => onTagClick?.('tag', label)}
              >
                #{label}
              </Badge>
            );
          })}
        </div>

        <h3 className="font-semibold text-lg line-clamp-2 story-link">{p.title}</h3>
        {summary && <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <AuthorChip id={p.author.id} name={p.author.name} avatar={p.author.avatar} onClick={() => onTagClick?.('author', p.author.id)} />
            <span className="text-xs text-muted-foreground">
              {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
              {words ? ` · ${readMin} min read` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{(p.counts?.likes || 0)} reactions</span>
            <span>{p.counts?.views || 0} views</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
