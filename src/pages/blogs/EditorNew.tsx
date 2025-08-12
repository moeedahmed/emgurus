import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createDraft, submitPost } from "@/lib/blogsApi";
import { supabase } from "@/integrations/supabase/client";

export default function EditorNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tagsInput, setTagsInput] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const [allTags, setAllTags] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user]);

  useEffect(() => {
    document.title = "Write Blog | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Create a draft blog and submit for review.");
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: cats } = await supabase.from("blog_categories").select("id,title").order("title");
      setCategories((cats as any) || []);
      const { data: tags } = await supabase.from("blog_tags").select("id,slug,title").order("title");
      setAllTags((tags as any) || []);
    };
    loadData();
  }, []);

  const onCoverFileChange = async (file?: File | null) => {
    if (!file || !user) return;
    try {
      setLoading(true);
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('blog-covers').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('blog-covers').getPublicUrl(path);
      setCover(data.publicUrl);
      toast.success("Cover uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async (submit = false) => {
    try {
      setLoading(true);
      const leftover = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const tag_slugs = Array.from(new Set([...tagList, ...leftover].map((t) => t.toLowerCase().replace(/\s+/g, "-"))));
      const res = await createDraft({ title, content_md: content, category_id: categoryId, tag_slugs, cover_image_url: cover || undefined });
      if (submit) await submitPost(res.id);
      toast.success(submit ? "Submitted. Thanks — admins will assign a guru reviewer and publish soon." : "Draft saved");
      navigate("/blogs/dashboard");
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
            <Label htmlFor="cover">Cover image</Label>
            <div className="space-y-2">
              <Input id="cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
              <Input type="file" accept="image/*" onChange={(e) => onCoverFileChange(e.target.files?.[0])} />
              {cover && (
                <img
                  src={cover}
                  alt="Blog cover preview"
                  className="mt-2 w-full max-h-64 object-cover rounded-md border"
                  loading="lazy"
                />
              )}
            </div>
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
          <div className="relative">
            <Input
              value={tagsInput}
              onChange={(e) => { setTagsInput(e.target.value); setShowTagSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const parts = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
                  if (parts.length) {
                    setTagList((prev) => Array.from(new Set([...prev, ...parts.map((t) => t.toLowerCase().replace(/\s+/g, '-'))])));
                    setTagsInput('');
                    setShowTagSuggestions(false);
                  }
                }
              }}
              placeholder="Type a tag and press Enter"
            />
            {showTagSuggestions && tagsInput && (
              <div className="absolute z-50 bg-popover border rounded-md mt-1 w-full max-h-48 overflow-auto shadow">
                {allTags
                  .filter(t => t.slug.includes(tagsInput.toLowerCase()) || (t.title || '').toLowerCase().includes(tagsInput.toLowerCase()))
                  .slice(0, 8)
                  .map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                      onClick={() => {
                        setTagList(prev => Array.from(new Set([...prev, t.slug])));
                        setTagsInput('');
                        setShowTagSuggestions(false);
                      }}
                    >
                      {t.title} ({t.slug})
                    </button>
                  ))}
                {allTags.filter(t => t.slug.includes(tagsInput.toLowerCase()) || (t.title || '').toLowerCase().includes(tagsInput.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Press Enter to add "{tagsInput}"</div>
                )}
              </div>
            )}
          </div>
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tagList.map((t) => (
                <Badge key={t} variant="secondary" className="flex items-center gap-1">
                  <span>{t}</span>
                  <button type="button" onClick={() => setTagList((prev) => prev.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="ml-1">×</button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Content</Label>
          <Textarea className="min-h-[300px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Heading\nYour content..." />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onSave(false)} disabled={loading}>Save Draft</Button>
          <Button onClick={() => onSave(true)} disabled={loading}>Submit</Button>
        </div>
      </Card>
      <link rel="canonical" href={`${window.location.origin}/blogs/editor/new`} />
    </main>
  );
}
