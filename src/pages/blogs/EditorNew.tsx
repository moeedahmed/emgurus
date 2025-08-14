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
import { isFeatureEnabled } from "@/lib/constants";
import BlocksPalette, { Block } from "@/components/blogs/editor/BlocksPalette";
import BlockEditor from "@/components/blogs/editor/BlockEditor";
import { blocksToMarkdown, markdownToBlocks } from "@/components/blogs/editor/BlocksToMarkdown";
import AuthGate from "@/components/auth/AuthGate";
import EmailVerifyBanner from "@/components/auth/EmailVerifyBanner";

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
  
  // New editor state
  const [useBlockEditor, setUseBlockEditor] = useState(isFeatureEnabled('BLOG_EDITOR_V2'));
  const [blocks, setBlocks] = useState<Block[]>([]);
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
      
      // Convert blocks to markdown if using block editor
      const finalContent = useBlockEditor ? blocksToMarkdown(blocks) : content;
      
      const res = await createDraft({ title, content_md: finalContent, category_id: categoryId, tag_slugs, cover_image_url: cover || undefined });
      if (submit) await submitPost(res.id);
      toast.success(submit ? "Submitted. Thanks — admins will assign a guru reviewer and publish soon." : "Draft saved");
      navigate("/blogs/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type,
      content: {},
      order: blocks.length,
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const handleUpdateBlock = (id: string, content: any) => {
    setBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, content } : block
    ));
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks(prev => prev.filter(block => block.id !== id));
  };

  const handleReorderBlocks = (dragIndex: number, hoverIndex: number) => {
    setBlocks(prev => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedItem);
      return updated.map((block, index) => ({ ...block, order: index }));
    });
  };

  const toggleEditor = () => {
    if (useBlockEditor) {
      // Convert blocks to markdown
      const markdown = blocksToMarkdown(blocks);
      setContent(markdown);
    } else {
      // Convert markdown to blocks
      const newBlocks = markdownToBlocks(content);
      setBlocks(newBlocks);
    }
    setUseBlockEditor(!useBlockEditor);
  };

  return (
    <AuthGate>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmailVerifyBanner className="mb-6" />
        
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">New Blog</h1>
          {isFeatureEnabled('BLOG_EDITOR_V2') && (
            <Button variant="outline" onClick={toggleEditor}>
              {useBlockEditor ? 'Revert to classic editor' : 'Use block editor'}
            </Button>
          )}
        </div>
      
      <div className="flex gap-6">
        <div className="flex-1">
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
        {useBlockEditor ? (
          <div className="space-y-4">
            <Label>Content (Block Editor)</Label>
            {blocks.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <div className="text-muted-foreground">
                  Start building your post by adding blocks from the palette →
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {blocks
                  .sort((a, b) => a.order - b.order)
                  .map(block => (
                    <BlockEditor
                      key={block.id}
                      block={block}
                      onUpdate={(content) => handleUpdateBlock(block.id, content)}
                      onRemove={() => handleRemoveBlock(block.id)}
                    />
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea className="min-h-[300px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Heading\nYour content..." />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onSave(false)} disabled={loading}>Save Draft</Button>
          <Button onClick={() => onSave(true)} disabled={loading}>Submit</Button>
        </div>
          </Card>
        </div>
        
        {useBlockEditor && (
          <div className="hidden lg:block">
            <BlocksPalette
              blocks={blocks}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onRemoveBlock={handleRemoveBlock}
              onReorderBlocks={handleReorderBlocks}
            />
          </div>
        )}
      </div>
      
      {useBlockEditor && (
        <div className="lg:hidden">
          <BlocksPalette
            blocks={blocks}
            onAddBlock={handleAddBlock}
            onUpdateBlock={handleUpdateBlock}
            onRemoveBlock={handleRemoveBlock}
            onReorderBlocks={handleReorderBlocks}
          />
        </div>
      )}
      
      <link rel="canonical" href={`${window.location.origin}/blogs/editor/new`} />
      </main>
    </AuthGate>
  );
}
