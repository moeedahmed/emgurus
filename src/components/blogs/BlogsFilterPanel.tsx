import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Search } from "lucide-react";

interface CategoryItem { title: string; count: number }
interface TagItem { slug: string; count: number }

export default function BlogsFilterPanel({
  q,
  category,
  sort,
  tag,
  categories,
  tags,
  onChange,
}: {
  q: string;
  category: string;
  sort: string;
  tag: string;
  categories: CategoryItem[];
  tags: TagItem[];
  onChange: (k: string, v: string) => void;
}) {
  const activeTag = tag;
  const clearFilters = () => {
    onChange("q", "");
    onChange("category", "");
    onChange("tag", "");
    onChange("sort", "newest");
  };

  return (
    <Card className="p-4 space-y-6">
      {/* Search */}
      <div>
        <label className="text-sm text-muted-foreground">Search</label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => onChange("q", e.target.value)} placeholder="Search title or excerpt" />
        </div>
      </div>

      <Separator />

      {/* Category */}
      <div>
        <label className="text-sm text-muted-foreground">Category</label>
        <Select value={category || "__all__"} onValueChange={(v) => onChange("category", v === "__all__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="__all__">All</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.title} value={c.title}>
                {c.title} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-muted-foreground">Tags</label>
          {activeTag && (
            <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => onChange("tag", "")}>Clear</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const selected = t.slug === activeTag;
            return (
              <Badge
                key={t.slug}
                variant={selected ? "secondary" : "outline"}
                className="cursor-pointer"
                onClick={() => onChange("tag", selected ? "" : t.slug)}
              >
                #{t.slug} · {t.count}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="text-sm text-muted-foreground">Sort</label>
        <Select value={sort} onValueChange={(v) => onChange("sort", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="liked">Most Liked</SelectItem>
            <SelectItem value="discussed">Most Discussed</SelectItem>
            <SelectItem value="editors">Editor’s Picks</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset */}
      <div className="pt-2">
        <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={clearFilters}>Reset filters</button>
      </div>
    </Card>
  );
}

