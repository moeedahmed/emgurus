import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createDraft, submitPost } from "@/lib/blogsApi";
import { supabase } from "@/integrations/supabase/client";
import { Block } from "@/components/blogs/editor/BlocksPalette";
import BlockEditor from "@/components/blogs/editor/BlockEditor";
import { blocksToMarkdown } from "@/components/blogs/editor/BlocksToMarkdown";
import AuthGate from "@/components/auth/AuthGate";
import EmailVerifyBanner from "@/components/auth/EmailVerifyBanner";
import BlogEditorSidebar from "@/components/blogs/editor/BlogEditorSidebar";

export default function EditorNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tagsInput, setTagsInput] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const [allTags, setAllTags] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  
  // Block editor is the default
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
      
      // Convert blocks to markdown
      const finalContent = blocksToMarkdown(blocks);
      
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


  return (
    <AuthGate>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmailVerifyBanner className="mb-6" />
        
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/blogs/dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      
      <div className="flex gap-8 relative">
        {/* Main Content */}
        <div className="flex-1 max-w-5xl">
          <Card className="p-8">
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl font-bold mb-8 text-center">New Blog</h1>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Enter your blog post title" 
                  className="text-lg py-3"
                />
              </div>
              
              <div className="border-t pt-8">
                <div className="space-y-4">
                  <Label htmlFor="cover" className="text-base font-semibold">Cover Image</Label>
                  <div className="space-y-4">
                    <Input 
                      id="cover" 
                      value={cover} 
                      onChange={(e) => setCover(e.target.value)} 
                      placeholder="https://example.com/image.jpg" 
                      className="py-3"
                    />
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="py-3"
                      onChange={(e) => onCoverFileChange(e.target.files?.[0])} 
                    />
                    {cover && (
                      <img
                        src={cover}
                        alt="Blog cover preview"
                        className="w-full max-h-80 object-cover rounded-lg border shadow-sm"
                        loading="lazy"
                      />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-8">
                <div className="space-y-6">
                  <Label className="text-base font-semibold">Content</Label>
                  {blocks.length === 0 ? (
                    <Card className="p-12 text-center border-dashed border-2">
                      <div className="text-muted-foreground">
                        Start building your post by adding blocks from the sidebar →
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-6">
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
              </div>

              <div className="border-t pt-8">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Tags</Label>
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
                      placeholder="Type a tag and press Enter or comma"
                      className="py-3"
                    />
                    {showTagSuggestions && tagsInput && (
                      <div className="absolute z-50 bg-popover border rounded-md mt-1 w-full max-h-48 overflow-auto shadow-lg">
                        {allTags
                          .filter(t => t.slug.includes(tagsInput.toLowerCase()) || (t.title || '').toLowerCase().includes(tagsInput.toLowerCase()))
                          .slice(0, 8)
                          .map(t => (
                            <button
                              key={t.id}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-accent rounded transition-colors"
                              onClick={() => {
                                setTagList(prev => Array.from(new Set([...prev, t.slug])));
                                setTagsInput('');
                                setShowTagSuggestions(false);
                              }}
                            >
                              <div className="font-medium">{t.title}</div>
                              <div className="text-xs text-muted-foreground">{t.slug}</div>
                            </button>
                          ))}
                        {allTags.filter(t => t.slug.includes(tagsInput.toLowerCase()) || (t.title || '').toLowerCase().includes(tagsInput.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-sm text-muted-foreground">Press Enter to add "{tagsInput}"</div>
                        )}
                      </div>
                    )}
                  </div>
                  {tagList.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {tagList.map((t) => (
                        <Badge key={t} variant="secondary" className="flex items-center gap-2 px-3 py-1 text-sm">
                          <span>{t}</span>
                          <button 
                            type="button" 
                            onClick={() => setTagList((prev) => prev.filter((x) => x !== t))} 
                            aria-label={`Remove ${t}`} 
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-8">
                <div className="flex gap-4 justify-end">
                  <Button variant="outline" onClick={() => onSave(false)} disabled={loading} size="lg">
                    Save Draft
                  </Button>
                  <Button onClick={() => onSave(true)} disabled={loading} size="lg">
                    Submit for Review
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Right Sidebar - Consolidated */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <BlogEditorSidebar
              onAddBlock={handleAddBlock}
              selectedCategoryId={categoryId}
              onCategoryChange={setCategoryId}
            />
          </div>
        </div>
      </div>
      
      <link rel="canonical" href={`${window.location.origin}/blogs/editor/new`} />
      </main>
    </AuthGate>
  );
}
