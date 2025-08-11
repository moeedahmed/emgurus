import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface CategoryItem { title: string; count: number }
interface AuthorItem { id: string; name: string; count: number }

export default function BlogsFilterPanel({
  q,
  category,
  author,
  sort,
  categories,
  authors,
  onChange,
  onReset,
}: {
  q: string;
  category: string;
  author: string;
  sort: string;
  categories: CategoryItem[];
  authors: AuthorItem[];
  onChange: (k: string, v: string) => void;
  onReset?: () => void;
}) {
  const clearFilters = () => {
    if (onReset) return onReset();
    onChange("q", "");
    onChange("category", "");
    onChange("author", "");
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
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Author */}
      <div>
        <label className="text-sm text-muted-foreground">Author</label>
        <Select value={author || "__all__"} onValueChange={(v) => onChange("author", v === "__all__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="__all__">All</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Button variant="outline" size="sm" onClick={clearFilters}>Reset</Button>
      </div>
    </Card>
  );
}

