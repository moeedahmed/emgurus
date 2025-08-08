import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { publishPost } from "@/lib/blogsApi";

export default function BlogsReview() {
  const { user, session } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("in_review");
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Review Blogs | EMGurus";
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/functions/v1/blogs-api/api/blogs/admin?status=${encodeURIComponent(status)}`, {
          headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } as any : {}) },
        });
        const data = await res.json();
        setItems(data.items || []);
      } catch {}
    };
    load();
  }, [status, session?.access_token]);

  const onPublish = async (id: string) => {
    try {
      await publishPost(id);
      toast.success("Published");
      setItems((arr) => arr.filter((i) => i.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const filtered = items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Review</h1>
      <div className="flex items-center gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} className="max-w-sm" />
      </div>
      <div className="space-y-3">
        {filtered.map((p) => (
          <Card key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.slug}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onPublish(p.id)}>Publish</Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-6">No items.</Card>}
      </div>
      <link rel="canonical" href={`${window.location.origin}/blogs/review`} />
    </main>
  );
}
