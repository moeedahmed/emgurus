import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { useRoles } from "@/hooks/useRoles";
import { submitPost, updateDraft } from "@/lib/blogsApi";
import { isFeatureEnabled } from "@/lib/constants";
import BlocksPalette, { Block } from "@/components/blogs/editor/BlocksPalette";
import BlockEditor from "@/components/blogs/editor/BlockEditor";
import { blocksToMarkdown, markdownToBlocks } from "@/components/blogs/editor/BlocksToMarkdown";
import AuthGate from "@/components/auth/AuthGate";
import RoleGate from "@/components/auth/RoleGate";
import EmailVerifyBanner from "@/components/auth/EmailVerifyBanner";

export default function EditorEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const { roles } = useRoles();
  const isAdmin = roles.includes("admin");
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
  const [isAssignedReviewer, setIsAssignedReviewer] = useState(false);
  
  // New editor state
  const [useBlockEditor, setUseBlockEditor] = useState(isFeatureEnabled('BLOG_EDITOR_V2'));
  const [blocks, setBlocks] = useState<Block[]>([]);
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
    const loadData = async () => {
      const { data: cats } = await supabase.from("blog_categories").select("id,title").order("title");
      setCategories((cats as any) || []);
      const { data: tags } = await supabase.from("blog_tags").select("id,slug,title").order("title");
      setAllTags((tags as any) || []);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!id) return;
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, title, description, content, cover_image_url, category_id, reviewer_id")
        .eq("id", id)
        .maybeSingle();
      if (!post) { toast.error("Draft not found"); navigate("/dashboard"); return; }
      setTitle((post as any).title || "");
      setCover((post as any).cover_image_url || "");
      const contentValue = (post as any).content || "";
      setContent(contentValue);
      setCategoryId((post as any).category_id || undefined);
      setIsAssignedReviewer(((post as any).reviewer_id && user?.id) ? (post as any).reviewer_id === user.id : false);
      
      // Initialize blocks if using block editor
      if (useBlockEditor && contentValue) {
        setBlocks(markdownToBlocks(contentValue));
      }
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
      
      // Convert blocks to markdown if using block editor
      const finalContent = useBlockEditor ? blocksToMarkdown(blocks) : content;
      
      await updateDraft(id, { title, content_md: finalContent, category_id: categoryId, tag_slugs, cover_image_url: cover || undefined });
      if (submit) await submitPost(id);
      toast.success(submit ? "Submitted. Thanks — admins will assign a guru reviewer and publish soon." : "Draft updated");
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

  const onReject = async () => {
    if (!id) return;
    const note = window.prompt('Provide a short note for rejection (visible to author):');
    if (!note || !note.trim()) { toast.error('Note is required'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.rpc('review_request_changes', { p_post_id: id, p_note: note.trim() });
      if (error) throw error as any;
      toast.success('Changes requested');
      navigate(-1);
    } catch (e) { console.error(e); toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const onApprove = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      if (isAdmin) {
        const { error } = await supabase.rpc('review_approve_publish', { p_post_id: id });
        if (error) throw error as any;
        toast.success('Post published');
      } else {
        const { error } = await supabase.from('blog_review_logs').insert({ post_id: id, actor_id: user.id, action: 'approve', note: '' });
        if (error) throw error as any;
        toast.success('Approved — sent to Admin Reviewed');
      }
      navigate(-1);
    } catch (e) { console.error(e); toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <AuthGate>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmailVerifyBanner className="mb-6" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Edit Blog</h1>
          </div>
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
              <Input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !user) return;
                try {
                  setLoading(true);
                  const path = `${user.id}/${Date.now()}-${f.name}`;
                  const { error: upErr } = await supabase.storage.from('blog-covers').upload(path, f, { upsert: false });
                  if (upErr) throw upErr;
                  const { data } = supabase.storage.from('blog-covers').getPublicUrl(path);
                  setCover(data.publicUrl);
                  toast.success('Cover uploaded');
                } catch (err) {
                  console.error(err);
                  toast.error('Upload failed');
                } finally {
                  setLoading(false);
                }
              }} />
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
        { (isAdmin || isAssignedReviewer) ? (
          <RoleGate roles={['admin', 'guru']}>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onReject} disabled={loading}>Reject</Button>
              <Button onClick={onApprove} disabled={loading}>Approve</Button>
            </div>
          </RoleGate>
        ) : (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onSave(false)} disabled={loading}>Save</Button>
            <Button onClick={() => onSave(true)} disabled={loading}>Submit</Button>
          </div>
        )}

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
      </main>
    </AuthGate>
  );
}
