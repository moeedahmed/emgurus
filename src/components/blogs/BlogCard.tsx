import BlogBaseCard from "@/components/blogs/BlogBaseCard";

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

export default function BlogCard({ post, topBadge, onOpen, onTagClick, selectedCategory, selectedTag }: BlogCardProps) {
  // Transform tags to proper format for BlogBaseCard
  const transformedTags = post.tags?.map(tag => 
    typeof tag === 'string' 
      ? { slug: tag, title: tag }
      : { slug: tag.slug, title: tag.title }
  ) || [];

  return (
    <BlogBaseCard
      id={post.id}
      title={post.title}
      slug={post.slug}
      excerpt={post.excerpt}
      cover_image_url={post.cover_image_url}
      category={post.category}
      tags={transformedTags}
      author={post.author}
      published_at={post.published_at}
      counts={post.counts}
      topBadge={topBadge?.label}
      onTagClick={(tag) => onTagClick?.('tag', tag)}
      onCategoryClick={(category) => onTagClick?.('category', category)}
      className="cursor-pointer"
    />
  );
}