import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

interface Category { id: string; name: string; }

const Editor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

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

  const save = async (status: "draft" | "submitted") => {
    try {
      if (!user) return;
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
      });
      if (error) throw error;
      toast.success(status === "draft" ? "Draft saved" : "Submitted for review");
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
          <Button variant="outline" onClick={() => save("draft")} disabled={loading}>Save Draft</Button>
          <Button onClick={() => save("submitted")} disabled={loading}>Submit</Button>
        </div>
      </div>
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter post title" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cover">Cover Image URL</Label>
          <Input id="cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description for SEO" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[300px]" placeholder="Write your article here..." />
        </div>
      </Card>
      <link rel="canonical" href={`${window.location.origin}/editor/new`} />
    </main>
  );
};

export default Editor;
