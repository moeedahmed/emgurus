import AuthorChip from "@/components/blogs/AuthorChip";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Eye, ThumbsUp, MessageCircle, Share2, Flag } from "lucide-react";
import fallbackImage from "@/assets/medical-blog.jpg";

interface BlogCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    category: { title?: string; slug?: string } | null;
    tags: string[] | { slug: string; title: string }[];
    author: { id: string; name: string; avatar: string | null };
    published_at: string | null;
    counts: { likes: number; comments?: number; views?: number; shares?: number; feedback?: number };
  };
  topBadge?: { label: string } | null;
  onOpen?: () => void;
  onTagClick?: (type: 'category' | 'tag' | 'author', value: string) => void;
  selectedCategory?: string;
  selectedTag?: string;
  selectedSort?: string;
}

export default function BlogCard({ post: p, topBadge, onOpen, onTagClick, selectedCategory, selectedTag, selectedSort }: BlogCardProps) {
  const cover = p.cover_image_url || fallbackImage;
  const words = (p.excerpt || "").split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.ceil(words / 220));
  const summary = p.excerpt || "Summary not available yet.";
  
  // Handle both string[] and object[] tag formats
  const tagStrings = (p.tags || []).map(t => typeof t === 'string' ? t : (t.slug || t.title));
  
  const badges: string[] = [];
  if ((p.counts?.likes || 0) >= 10) badges.push("Most Discussed");
  if (tagStrings.some((t) => /editor|pick/i.test(t))) badges.push("Editor's Pick");
  if (tagStrings.some((t) => /featured|star|top/i.test(t))) badges.push("Featured");

  return (
    <Card
      className="overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] relative rounded-2xl"
      onClick={onOpen}
      aria-label={`Open blog post ${p.title}`}
    >
      <div className="relative">
        <img
          src={cover}
          alt={`${p.title} cover image`}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        {topBadge?.label && (
          <div className="absolute top-3 left-3">
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
              Featured
            </span>
          </div>
        )}
      </div>
      <div className="p-2 sm:p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {topBadge?.label && (
            <Chip
              name="blogs_top_chip"
              value="most-liked"
              selected={selectedSort === 'liked'}
              variant={selectedSort === 'liked' ? 'solid' : 'outline'}
              size="sm"
              onSelect={() => onTagClick?.('tag', 'most-liked')}
            >
              {topBadge.label}
            </Chip>
          )}
          {badges.map((b) => (
            <Badge key={b} variant="outline" className="text-xs">
              {b}
            </Badge>
          ))}
          {p.category?.title && !/^imported$/i.test(p.category.title) && (
            <Chip
              name="blogs_category_chip"
              value={p.category!.title!}
              selected={selectedCategory === p.category!.title!}
              variant={selectedCategory === p.category!.title! ? "solid" : "outline"}
              size="sm"
              onSelect={() => onTagClick?.('category', p.category!.title!)}
            >
              {p.category.title}
            </Chip>
          )}
          {tagStrings.slice(0, 3).map((label) => {
            const active = selectedTag === label;
            return (
              <Chip
                key={label}
                name="blogs_tag_chip"
                value={label}
                selected={active}
                variant={active ? "solid" : "outline"}
                size="sm"
                onSelect={() => onTagClick?.('tag', label)}
              >
                #{label}
              </Chip>
            );
          })}
        </div>

        <h3 className="font-bold text-lg line-clamp-2 story-link leading-tight hover:text-primary transition-colors">{p.title}</h3>
        {summary && <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{summary}</p>}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <AuthorChip id={p.author.id} name={p.author.name} avatar={p.author.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E"} onClick={() => onTagClick?.('author', p.author.id)} />
            <span className="text-xs text-muted-foreground">
              {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
              {words ? ` · ${readMin} min read` : ""}
            </span>
          </div>
          
          {/* Standardized Engagement Bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {/* Views - always show */}
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">Views: </span>
              {p.counts?.views || 0}
            </span>
            
            {/* Likes - always show */}
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              <span className="hidden sm:inline">Likes: </span>
              {p.counts?.likes || 0}
            </span>
            
            {/* Comments - always show */}
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Comments: </span>
              {p.counts?.comments || 0}
            </span>
            
            {/* Shares - show when > 0 */}
            {(p.counts?.shares || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                <span className="hidden sm:inline">Shares: </span>
                {p.counts.shares}
              </span>
            )}
            
            {/* Feedback - show when > 0 */}
            {(p.counts?.feedback || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                <span className="hidden sm:inline">Feedback: </span>
                {p.counts.feedback}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}