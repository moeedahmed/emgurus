import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import AuthorChip from "@/components/blogs/AuthorChip";
import { Eye, ThumbsUp, MessageCircle, Share2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementCounts {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  feedback?: number;
}

interface Author {
  id: string;
  name: string;
  avatar?: string | null;
}

interface Category {
  title?: string | null;
}

interface Tag {
  slug?: string;
  title?: string;
}

interface BlogBaseCardProps {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  category?: Category | null;
  tags?: Tag[];
  author?: Author;
  published_at?: string | null;
  counts?: EngagementCounts;
  topBadge?: string;
  isFeatured?: boolean;
  isHero?: boolean;
  className?: string;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export default function BlogBaseCard({
  id,
  title,
  slug,
  excerpt,
  cover_image_url,
  category,
  tags,
  author,
  published_at,
  counts,
  topBadge,
  isFeatured = false,
  isHero = false,
  className,
  onTagClick,
  onCategoryClick
}: BlogBaseCardProps) {
  const date = published_at ? new Date(published_at).toLocaleDateString() : "";
  const readTime = excerpt ? Math.ceil(excerpt.split(' ').length / 200) : 1;

  // Generate dynamic badges based on engagement
  const generateBadges = () => {
    const badges = [];
    
    if (isFeatured) {
      badges.push({ label: "Featured", variant: "default" as const });
    }
    
    if (topBadge) {
      badges.push({ label: topBadge, variant: "secondary" as const });
    }
    
    if (counts?.likes && counts.likes > 50) {
      badges.push({ label: "Most Liked", variant: "secondary" as const });
    }
    
    if (counts?.comments && counts.comments > 20) {
      badges.push({ label: "Most Discussed", variant: "secondary" as const });
    }
    
    return badges;
  };

  const badges = generateBadges();

  // Hero layout for featured single posts
  if (isHero) {
    return (
      <Card className={cn(
        "relative overflow-hidden rounded-2xl border group hover-scale motion-safe:transition-all motion-safe:duration-200",
        className
      )}>
        <img
          src={cover_image_url || "/placeholder.svg"}
          alt={`${title} cover image`}
          className="w-full h-[260px] sm:h-[360px] lg:h-[420px] object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8 text-foreground">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {badges.map((badge, index) => (
              <Badge key={index} variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            ))}
            {category?.title && (
              <Chip
                name={category.title}
                value={category.title}
                selected={false}
                onSelect={() => onCategoryClick?.(category.title!)}
                variant="outline"
                size="sm"
              >
                {category.title}
              </Chip>
            )}
            {date && <span className="text-xs text-muted-foreground">{date}</span>}
          </div>
          <Link to={`/blogs/${slug}`}>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold max-w-3xl mb-2 group-hover:text-primary motion-safe:transition-colors">
              {title}
            </h3>
          </Link>
          {excerpt && (
            <p className="mt-2 max-w-2xl line-clamp-2 text-sm sm:text-base text-muted-foreground">
              {excerpt}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {author && (
              <AuthorChip id={author.id} name={author.name} avatar={author.avatar || null} />
            )}
            <Button asChild size="sm" variant="secondary" className="ml-auto">
              <Link to={`/blogs/${slug}`}>Read Article</Link>
            </Button>
          </div>
          {/* Engagement Bar for Hero */}
          {counts && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>{counts.views || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  <span>{counts.likes || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  <span>{counts.comments || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  <span>{counts.shares || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flag className="h-3 w-3" />
                  <span>{counts.feedback || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0 hover:bg-accent/60 hover:scale-105 motion-safe:transition-all"
                >
                  <Share2 className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0 hover:bg-accent/60 hover:scale-105 motion-safe:transition-all"
                >
                  <Flag className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Regular card layout
  return (
    <Link to={`/blogs/${slug}`} className="block">
      <Card className={cn(
        "overflow-hidden group hover-scale motion-safe:transition-all motion-safe:duration-200",
        className
      )}>
      <div className="relative">
        <img
          src={cover_image_url || "/placeholder.svg"}
          alt={`${title} cover image`}
          className="w-full h-48 object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {badges.map((badge, index) => (
            <Badge key={index} variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="p-4">
        {/* Category and Date */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {category?.title && (
            <Chip
              name={category.title}
              value={category.title}
              selected={false}
              onSelect={() => onCategoryClick?.(category.title!)}
            >
              {category.title}
            </Chip>
          )}
          {date && <span className="text-xs text-muted-foreground">{date}</span>}
          <span className="text-xs text-muted-foreground">• {readTime} min read</span>
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary motion-safe:transition-colors">
          {title}
        </h3>
        
        {/* Excerpt */}
        {excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {excerpt}
          </p>
        )}
        
        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag, index) => (
              <Chip
                key={index}
                name={tag.title || tag.slug || ""}
                value={tag.slug || tag.title || ""}
                selected={false}
                onSelect={() => onTagClick?.(tag.slug || tag.title || "")}
              >
                {tag.title || tag.slug}
              </Chip>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{tags.length - 3} more</span>
            )}
          </div>
        )}
        
        {/* Author */}
        {author && (
          <div className="mb-3">
            <AuthorChip 
              id={author.id} 
              name={author.name} 
              avatar={author.avatar || null} 
            />
          </div>
        )}
        
        {/* Engagement Bar */}
        {counts && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{counts.views || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                <span>{counts.likes || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                <span>{counts.comments || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                <span>{counts.shares || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                <span>{counts.feedback || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0 hover:bg-accent/60 hover:scale-105 motion-safe:transition-all"
              >
                <Share2 className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0 hover:bg-accent/60 hover:scale-105 motion-safe:transition-all"
              >
                <Flag className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
    </Link>
  );
}