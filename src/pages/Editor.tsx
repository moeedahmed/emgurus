import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DOMPurify from "dompurify";

interface Category { id: string; name: string; }

const STORAGE_KEY = 'editor_draft_v1';

const Editor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    document.title = "Write Article | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Create and submit a medical article for guru review on EMGurus.");
  }, []);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("blog_categories").select("id,name").order("name");
      setCategories((data as any) || []);
    };
    load();
  }, []);

  // Restore from local storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!title && !description && !content) {
          setTitle(d.title || "");
          setDescription(d.description || "");
          setCover(d.cover || "");
          setCategoryId(d.categoryId || undefined);
          setContent(d.content || "");
          setTags(Array.isArray(d.tags) ? d.tags : []);
        }
      }
    } catch {}
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const i = setInterval(() => {
      const payload = { title, description, cover, categoryId, content, tags };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 30000);
    return () => clearInterval(i);
  }, [title, description, cover, categoryId, content, tags]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((x) => [...x, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((x) => x.filter((i) => i !== t));

  const isDescRecommended = useMemo(() => description.length >= 120 && description.length <= 180, [description]);

  const save = async (status: "draft" | "in_review") => {
    try {
      if (!user) return;
      if (title.trim().length < 8) {
        toast.error("Title must be at least 8 characters");
        return;
      }
      if (!content.trim()) {
        toast.error("Content is required");
        return;
      }
      if (!categoryId) {
        toast.error("Please select a category");
        return;
      }
      if (!isDescRecommended) {
        toast("Tip: Description works best between 120–180 characters");
      }

      setLoading(true);
      const slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      const { error } = await supabase.from("blog_posts").insert({
        author_id: user.id,
        title,
        description,
        cover_image_url: cover || null,
        category_id: categoryId || null,
        content,
        status,
        slug,
        tags,
      });
      if (error) throw error;
      toast.success(status === "draft" ? "Draft saved" : "Submitted for review");
      localStorage.removeItem(STORAGE_KEY);
      navigate("/blog");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Post</h1>
        <div className="flex gap-2">
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogTrigger asChild>
              <Button variant="secondary">Preview</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Post Preview</DialogTitle>
              </DialogHeader>
              <article className="prose dark:prose-invert max-w-none">
                <h1>{title || "Untitled"}</h1>
                {cover && <img src={cover} alt="Cover" className="w-full max-h-96 object-cover rounded-md" />}
                {description && <p className="text-muted-foreground">{description}</p>}
                {content ? (
                  /<\w+[^>]*>/.test(content) ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-base">{content}</pre>
                  )
                ) : (
                  <p className="text-muted-foreground">No content yet.</p>
                )}
              </article>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => save("draft")} disabled={loading}>Save Draft</Button>
          <Button onClick={() => save("in_review")} disabled={loading}>Submit</Button>
        </div>
      </div>
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter post title" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cover">Cover Image URL</Label>
          <Input id="cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://... (jpeg/png/webp, &lt; 5MB)" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input id="tags" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a tag and press Enter" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="secondary" onClick={addTag}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTag(t)}>{t} ×</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Short Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="120–180 characters for SEO" />
          <p className={`text-xs ${isDescRecommended ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{description.length} characters</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Main Content</Label>
          <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[300px]" placeholder="Write your article here... (HTML or Markdown)" />
        </div>
      </Card>
      <link rel="canonical" href={`${window.location.origin}/editor/new`} />
    </main>
  );
};

export default Editor;
