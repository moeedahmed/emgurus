import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  return (
    <aside className="space-y-6">
      <div>
        <label className="text-sm text-muted-foreground">Search</label>
        <Input value={q} onChange={(e) => onChange("q", e.target.value)} placeholder="Search title or excerpt" />
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Category</label>
        <Select value={category || "__all__"} onValueChange={(v) => onChange("category", v === "__all__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.title} value={c.title}>
                {c.title} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="text-sm text-muted-foreground mb-2">Popular tags</div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t.slug}
              onClick={() => onChange("tag", t.slug === tag ? "" : t.slug)}
              className={`px-2 py-1 rounded-full border ${t.slug === tag ? "bg-accent" : ""}`}
            >
              #{t.slug} ({t.count})
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Sort</label>
        <Select value={sort} onValueChange={(v) => onChange("sort", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="liked">Most Liked</SelectItem>
            <SelectItem value="discussed">Most Discussed</SelectItem>
            <SelectItem value="editors">Editor’s Picks</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </aside>
  );
}
