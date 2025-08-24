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
import { submitPost, updateDraft, approveForPublishing } from "@/lib/blogsApi";
import { isFeatureEnabled } from "@/lib/constants";
import { Block } from "@/components/blogs/editor/BlocksPalette";
import BlockEditor from "@/components/blogs/editor/BlockEditor";
import { blocksToMarkdown, markdownToBlocks } from "@/components/blogs/editor/BlocksToMarkdown";
import AuthGate from "@/components/auth/AuthGate";
import RoleGate from "@/components/auth/RoleGate";
import EmailVerifyBanner from "@/components/auth/EmailVerifyBanner";
import BlogEditorSidebar from "@/components/blogs/editor/BlogEditorSidebar";
import BlogChat from "@/components/blogs/BlogChat";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { reviewPost } from "@/lib/blogsApi";

export default function EditorEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const { roles } = useRoles();
  const isAdmin = roles.includes("admin");
  const isGuru = roles.includes("guru");
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tagsInput, setTagsInput] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isAssignedReviewer, setIsAssignedReviewer] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  
  // Block editor is the default
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
        .select("id, title, description, content, cover_image_url, category_id, is_featured")
        .eq("id", id)
        .maybeSingle();
      if (!post) { toast.error("Draft not found"); navigate("/dashboard"); return; }
      setTitle((post as any).title || "");
      setCover((post as any).cover_image_url || "");
      const contentValue = (post as any).content || "";
      setContent(contentValue);
      setCategoryId((post as any).category_id || undefined);
      setIsFeatured((post as any).is_featured || false);
      
      // Check if current user is assigned as reviewer via blog_review_assignments
      if (user?.id) {
        const { data: assignment } = await supabase
          .from("blog_review_assignments")
          .select("id")
          .eq("post_id", id)
          .eq("reviewer_id", user.id)
          .eq("status", "pending")
          .maybeSingle();
        setIsAssignedReviewer(!!assignment);
      }
      
      // Initialize blocks from content
      if (contentValue) {
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
      
      // Convert blocks to markdown
      const finalContent = blocksToMarkdown(blocks);
      
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
        // First approve the review assignment
        await approveForPublishing(id);
        // Then publish the post
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
                <h1 className="text-4xl font-bold mb-8 text-center">Edit Blog</h1>
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
                      onChange={async (e) => {
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
                      }} 
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
                        Start building your post by adding blocks from the palette ←
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

               {isAdmin && (
                 <div className="border-t pt-8">
                   <div className="flex items-center justify-between">
                     <div>
                       <Label htmlFor="featured" className="text-base font-semibold">
                         Featured Post
                       </Label>
                       <p className="text-sm text-muted-foreground mt-1">
                         Mark this post as featured to display it prominently on the blog homepage
                       </p>
                     </div>
                     <Switch
                       id="featured"
                       checked={isFeatured}
                       onCheckedChange={setIsFeatured}
                     />
                   </div>
                 </div>
               )}

               <div className="border-t pt-8">
                 { (isAdmin || isAssignedReviewer) ? (
                   <RoleGate roles={['admin', 'guru']}>
                    <div className="flex gap-4 justify-end">
                      <Button variant="outline" onClick={onReject} disabled={loading} size="lg">
                        Reject Changes
                      </Button>
                      <Button onClick={onApprove} disabled={loading} size="lg">
                        Approve & Publish
                      </Button>
                    </div>
                  </RoleGate>
                ) : (
                  <div className="flex gap-4 justify-end">
                    <Button variant="outline" onClick={() => onSave(false)} disabled={loading} size="lg">
                      Save Draft
                    </Button>
                    <Button onClick={() => onSave(true)} disabled={loading} size="lg">
                      Submit for Review
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
        
        {/* Right Sidebar - Consolidated */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-6">
            <BlogEditorSidebar
              onAddBlock={handleAddBlock}
              selectedCategoryId={categoryId}
              onCategoryChange={setCategoryId}
            />
            {id && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 font-semibold text-left bg-card border rounded-lg hover:bg-accent transition-colors">
                  Discussion
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <BlogChat postId={id} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>
      </main>
    </AuthGate>
  );
}
