import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitPost, updateDraft } from "@/lib/blogsApi";

export default function EditorEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tagsInput, setTagsInput] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user]);

  useEffect(() => {
    document.title = "Edit Blog | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Edit your draft blog and submit for review.");
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", `${window.location.origin}/blogs/editor/${id}`);
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [id]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase.from("blog_categories").select("id,title").order("title");
      setCategories((data as any) || []);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!id) return;
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, title, description, content, cover_image_url, category_id")
        .eq("id", id)
        .maybeSingle();
      if (!post) { toast.error("Draft not found"); navigate("/dashboard"); return; }
      setTitle((post as any).title || "");
      setCover((post as any).cover_image_url || "");
      setExcerpt((post as any).description || "");
      setContent((post as any).content || "");
      setCategoryId((post as any).category_id || undefined);
      // Load tags
      const { data: tagRows } = await supabase
        .from("blog_post_tags")
        .select("tag:blog_tags(slug)")
        .eq("post_id", id);
      const slugs = ((tagRows as any[]) || []).map((t) => t.tag?.slug).filter(Boolean);
      setTagList(slugs);
    };
    loadDraft();
  }, [id]);

  const onSave = async (submit = false) => {
    try {
      if (!id) return;
      setLoading(true);
      const leftover = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const tag_slugs = Array.from(new Set([...tagList, ...leftover].map((t) => t.toLowerCase().replace(/\s+/g, "-"))));
      await updateDraft(id, { title, content_md: content, category_id: categoryId, tag_slugs, cover_image_url: cover || undefined, excerpt: excerpt || undefined });
      if (submit) await submitPost(id);
      toast.success(submit ? "Submitted for review" : "Draft updated");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Draft</h1>
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
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const parts = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
                if (parts.length) {
                  setTagList((prev) => Array.from(new Set([...prev, ...parts.map((t) => t.toLowerCase().replace(/\s+/g, '-'))])));
                  setTagsInput('');
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
                  <button type="button" onClick={() => setTagList((prev) => prev.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="ml-1">×</button>
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
          <Button variant="outline" onClick={() => onSave(false)} disabled={loading}>Save</Button>
          <Button onClick={() => onSave(true)} disabled={loading}>Submit for Review</Button>
        </div>
      </Card>
    </main>
  );
}
