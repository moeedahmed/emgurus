import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ForumsFilterPanel({
  q,
  section,
  sections,
  topics,
  onChange,
  onReset,
}: {
  q: string;
  section: string;
  sections: Array<{ id: string; title: string }>;
  topics: string[];
  onChange: (k: 'q' | 'section' | 'topic', v: string) => void;
  onReset: () => void;
}) {
  return (
    <Card className="p-4 space-y-4">
      <div>
        <label className="text-sm text-muted-foreground">Search</label>
        <Input
          className="mt-1"
          placeholder="Search title or content"
          value={q}
          onChange={(e) => onChange('q', e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Section</label>
        <Select value={section || "__all__"} onValueChange={(v) => onChange('section', v === "__all__" ? "" : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="All Sections" /></SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="__all__">All Sections</SelectItem>
            {sections.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {topics.length > 0 && (
        <div>
          <label className="text-sm text-muted-foreground">Topic</label>
          <Select onValueChange={(v) => onChange('topic', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="All Topics" /></SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="">All Topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={onReset}>Reset</Button>
      </div>
    </Card>
  );
}
