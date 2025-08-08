import { Card } from "@/components/ui/card";

interface CategoryItem { title: string; count: number }

export default function BrowseByCategoryPanel({
  categories,
  onSelect,
}: {
  categories: CategoryItem[];
  onSelect: (v: string) => void;
}) {
  if (!categories?.length) return null;
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3">Browse by Category</div>
      <div className="flex flex-wrap gap-2">
        <button
          className="px-2 py-1 rounded-full border text-sm"
          onClick={() => onSelect("__all__")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.title}
            className="px-2 py-1 rounded-full border text-sm"
            onClick={() => onSelect(c.title)}
          >
            {c.title} ({c.count})
          </button>
        ))}
      </div>
    </Card>
  );
}
