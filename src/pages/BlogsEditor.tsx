import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createDraft, submitPost } from "@/lib/blogsApi";
import { supabase } from "@/integrations/supabase/client";

export default function BlogsEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tags, setTags] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user]);

  useEffect(() => {
    document.title = "Write Blog | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Create a draft blog and submit for review.");
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase.from("blog_categories").select("id,title").order("title");
      setCategories((data as any) || []);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!excerpt && content) setExcerpt(content.replace(/<[^>]*>/g, " ").slice(0, 160));
  }, [content]);

  const onSave = async (submit = false) => {
    try {
      setLoading(true);
      const leftover = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const tag_slugs = Array.from(new Set([...tagList, ...leftover].map((t) => t.toLowerCase().replace(/\s+/g, "-"))));
      const res = await createDraft({ title, content_md: content, category_id: categoryId, tag_slugs, cover_image_url: cover || undefined, excerpt: excerpt || undefined });
      if (submit) await submitPost(res.id);
      toast.success(submit ? "Submitted for review" : "Draft saved");
      navigate("/blogs");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">New Blog</h1>
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cover">Cover image URL</Label>
            <Input id="cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="z-50">
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const parts = tags.split(',').map((t) => t.trim()).filter(Boolean);
                if (parts.length) {
                  setTagList((prev) => Array.from(new Set([...prev, ...parts.map((t) => t.toLowerCase().replace(/\\s+/g, '-'))])));
                  setTags('');
                }
              }
            }}
            placeholder="Type a tag and press Enter"
          />
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tagList.map((t) => (
                <Badge key={t} variant="secondary" className="flex items-center gap-1">
                  <span>#{t}</span>
                  <button
                    type="button"
                    onClick={() => setTagList((prev) => prev.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="ml-1"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Excerpt</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short description for SEO (~160 chars)" />
        </div>
        <div className="space-y-2">
          <Label>Content (Markdown supported)</Label>
          <Textarea className="min-h-[300px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Heading\nYour content..." />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onSave(false)} disabled={loading}>Save Draft</Button>
          <Button onClick={() => onSave(true)} disabled={loading}>Submit for Review</Button>
        </div>
      </Card>
      <link rel="canonical" href={`${window.location.origin}/blogs/new`} />
    </main>
  );
}
