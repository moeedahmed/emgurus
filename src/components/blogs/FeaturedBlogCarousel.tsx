import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import BlogBaseCard from "@/components/blogs/BlogBaseCard";

interface FeaturedPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  category?: { title?: string | null } | null;
  tags?: { slug?: string; title?: string }[];
  author?: { id: string; name: string; avatar?: string | null };
  published_at?: string | null;
  counts?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    feedback?: number;
  };
}

interface FeaturedBlogCarouselProps {
  posts: FeaturedPost[];
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export default function FeaturedBlogCarousel({ posts, onTagClick, onCategoryClick }: FeaturedBlogCarouselProps) {
  if (!posts || posts.length === 0) return null;

  // If only one post, render the hero style using BlogBaseCard
  if (posts.length === 1) {
    const post = posts[0];
    
    return (
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground">Featured Article</h2>
        </div>
        <BlogBaseCard
          id={post.id}
          title={post.title}
          slug={post.slug}
          excerpt={post.excerpt}
          cover_image_url={post.cover_image_url}
          category={post.category}
          tags={post.tags}
          author={post.author}
          published_at={post.published_at}
          counts={post.counts}
          isFeatured={true}
          isHero={true}
          onTagClick={onTagClick}
          onCategoryClick={onCategoryClick}
        />
      </section>
    );
  }

  // Multiple posts - use carousel for mobile, grid for desktop
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">Featured Articles</h2>
      </div>
      
      {/* Mobile Carousel */}
      <div className="md:hidden">
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {posts.map((post) => (
              <CarouselItem key={post.id} className="pl-2 md:pl-4 basis-[85%]">
                <BlogBaseCard
                  id={post.id}
                  title={post.title}
                  slug={post.slug}
                  excerpt={post.excerpt}
                  cover_image_url={post.cover_image_url}
                  category={post.category}
                  tags={post.tags}
                  author={post.author}
                  published_at={post.published_at}
                  counts={post.counts}
                  isFeatured={true}
                  onTagClick={onTagClick}
                  onCategoryClick={onCategoryClick}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogBaseCard
            key={post.id}
            id={post.id}
            title={post.title}
            slug={post.slug}
            excerpt={post.excerpt}
            cover_image_url={post.cover_image_url}
            category={post.category}
            tags={post.tags}
            author={post.author}
            published_at={post.published_at}
            counts={post.counts}
            isFeatured={true}
            onTagClick={onTagClick}
            onCategoryClick={onCategoryClick}
          />
        ))}
      </div>
    </section>
  );
}