import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        <Label htmlFor="forums-search" className="text-sm text-muted-foreground">Search</Label>
        <Input
          id="forums-search"
          className="mt-1"
          placeholder="Search title or content"
          value={q}
          onChange={(e) => onChange('q', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="forums-section" className="text-sm text-muted-foreground">Section</Label>
        <Select value={section || "__all__"} onValueChange={(v) => onChange('section', v === "__all__" ? "" : v)}>
          <SelectTrigger id="forums-section" className="mt-1"><SelectValue placeholder="All Sections" /></SelectTrigger>
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
          <Label htmlFor="forums-topic" className="text-sm text-muted-foreground">Topic</Label>
          <Select onValueChange={(v) => onChange('topic', v)}>
            <SelectTrigger id="forums-topic" className="mt-1"><SelectValue placeholder="All Topics" /></SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="all">All Topics</SelectItem>
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
