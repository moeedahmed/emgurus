import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface Item { slug: string; title: string; comments: number; }

export default function RecentlyDiscussedPanel({ items }: { items: Item[] }) {
  if (!items?.length) return null;
  const top = [...items].sort((a, b) => b.comments - a.comments).slice(0, 5);
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3">Recently Discussed</div>
      <ul className="space-y-2">
        {top.map((p) => (
          <li key={p.slug} className="flex items-center justify-between gap-3">
            <Link to={`/blogs/${p.slug}`} className="text-sm hover:underline line-clamp-1">{p.title}</Link>
            <span className="text-xs text-muted-foreground">{p.comments}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
