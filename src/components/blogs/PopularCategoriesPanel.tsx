import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function PopularCategoriesPanel({ categories }: { categories: { title: string; count: number }[] }) {
  if (!categories?.length) return null;
  const top = [...categories].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3">Popular Categories</div>
      <ul className="space-y-2">
        {top.map((c) => (
          <li key={c.title} className="flex items-center justify-between">
            <Link to={`/blogs?category=${encodeURIComponent(c.title)}`} className="text-sm hover:underline">
              {c.title}
            </Link>
            <span className="text-xs text-muted-foreground">{c.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
