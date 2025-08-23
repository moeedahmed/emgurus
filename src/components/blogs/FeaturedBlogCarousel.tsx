import { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import AuthorChip from "@/components/blogs/AuthorChip";

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
}

interface FeaturedBlogCarouselProps {
  posts: FeaturedPost[];
}

export default function FeaturedBlogCarousel({ posts }: FeaturedBlogCarouselProps) {
  if (!posts || posts.length === 0) return null;

  // If only one post, render the hero style
  if (posts.length === 1) {
    const post = posts[0];
    const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
    
    return (
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground">Featured Article</h2>
        </div>
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">Featured</span>
              {post.category?.title && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {post.category.title}
                </span>
              )}
              {date && <span className="text-xs text-muted-foreground">{date}</span>}
            </div>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold max-w-3xl mb-2">
              {post.title}
            </h3>
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
            {posts.map((post) => {
              const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
              return (
                <CarouselItem key={post.id} className="pl-2 md:pl-4 basis-[85%]">
                  <Card className="overflow-hidden">
                    <div className="relative">
                      <img
                        src={post.cover_image_url || "/placeholder.svg"}
                        alt={`${post.title} cover image`}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute top-2 left-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">Featured</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {post.category?.title && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {post.category.title}
                          </span>
                        )}
                        {date && <span className="text-xs text-muted-foreground">{date}</span>}
                      </div>
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {post.author && (
                          <AuthorChip id={post.author.id} name={post.author.name} avatar={post.author.avatar || null} />
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/blogs/${post.slug}`}>Read</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
          return (
            <Card key={post.id} className="overflow-hidden">
              <div className="relative">
                <img
                  src={post.cover_image_url || "/placeholder.svg"}
                  alt={`${post.title} cover image`}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-2 left-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">Featured</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {post.category?.title && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {post.category.title}
                    </span>
                  )}
                  {date && <span className="text-xs text-muted-foreground">{date}</span>}
                </div>
                <h3 className="font-bold text-lg mb-2 line-clamp-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {post.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {post.author && (
                    <AuthorChip id={post.author.id} name={post.author.name} avatar={post.author.avatar || null} />
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/blogs/${post.slug}`}>Read</Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}