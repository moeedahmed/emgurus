import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FolderTree, Tag } from "lucide-react";
import { useRoles } from "@/hooks/useRoles";
import RoleGate from "@/components/auth/RoleGate";

interface Category {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  post_count?: number;
  children?: Category[];
}

interface BlogCategoryPanelProps {
  selectedCategoryId?: string;
  selectedTags?: string[];
  onCategoryChange: (categoryId: string | undefined) => void;
  onTagsChange: (tags: string[]) => void;
}

export default function BlogCategoryPanel({ 
  selectedCategoryId, 
  selectedTags = [], 
  onCategoryChange, 
  onTagsChange 
}: BlogCategoryPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [newTagTitle, setNewTagTitle] = useState("");
  const { roles } = useRoles();
  const isAdmin = roles.includes('admin');

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load categories
      const { data: cats } = await supabase
        .from('blog_categories')
        .select(`
          id, title, slug, parent_id,
          posts:blog_posts(count)
        `)
        .order('title');
        
      const categoriesWithCounts = (cats || []).map((cat: any) => ({
        ...cat,
        post_count: cat.posts?.[0]?.count || 0,
      }));
      
      // Build hierarchy
      const buildTree = (items: Category[], parentId: string | null = null): Category[] => {
        return items
          .filter(item => item.parent_id === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id),
          }));
      };
      
      const tree = buildTree(categoriesWithCounts);
      setCategories(tree);
      
      // Load tags
      const { data: tags } = await supabase
        .from('blog_tags')
        .select('id, slug, title')
        .order('title');
      setAllTags(tags || []);
      
    } catch (error) {
      console.error('Failed to load categories/tags:', error);
      toast.error('Failed to load categories and tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createCategory = async () => {
    if (!newCategoryTitle.trim()) return;
    
    try {
      const slug = newCategoryTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_categories')
        .insert({
          title: newCategoryTitle.trim(),
          slug,
          name: newCategoryTitle.trim(),
          parent_id: newCategoryParent,
        });
        
      if (error) throw error;
      
      toast.success('Category created');
      setNewCategoryTitle("");
      setNewCategoryParent(null);
      setIsCreateCategoryOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    }
  };

  const createTag = async () => {
    if (!newTagTitle.trim()) return;
    
    try {
      const slug = newTagTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_tags')
        .insert({
          title: newTagTitle.trim(),
          slug,
        });
        
      if (error) throw error;
      
      toast.success('Tag created');
      setNewTagTitle("");
      setIsCreateTagOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('Failed to create tag');
    }
  };

  const flattenCategories = (cats: Category[], level = 0): (Category & { level: number })[] => {
    return cats.reduce((acc, cat) => {
      acc.push({ ...cat, level });
      if (cat.children) {
        acc.push(...flattenCategories(cat.children, level + 1));
      }
      return acc;
    }, [] as (Category & { level: number })[]);
  };

  const flatCategories = flattenCategories(categories);

  const toggleTag = (tagSlug: string) => {
    const newTags = selectedTags.includes(tagSlug)
      ? selectedTags.filter(t => t !== tagSlug)
      : [...selectedTags, tagSlug];
    onTagsChange(newTags);
  };

  if (loading) {
    return <Card className="p-4 h-96 animate-pulse" />;
  }

  return (
    <Card className="p-4 sticky top-20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5" />
          <h3 className="font-semibold">Blog Organization</h3>
        </div>
        
        <Tabs defaultValue="category" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="category">Category</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>
          
          <TabsContent value="category" className="space-y-3">
            <div className="space-y-2">
              <Label>Primary Category</Label>
              <Select value={selectedCategoryId} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="">No category</SelectItem>
                  {flatCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {'  '.repeat(cat.level)}{cat.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <RoleGate roles={['admin']}>
              <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    New Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Category</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={newCategoryTitle}
                        onChange={(e) => setNewCategoryTitle(e.target.value)}
                        placeholder="Category title"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Parent Category (optional)</Label>
                      <Select value={newCategoryParent || undefined} onValueChange={(value) => setNewCategoryParent(value === 'none' ? null : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No parent (top level)</SelectItem>
                          {flatCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {'  '.repeat(cat.level)}{cat.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsCreateCategoryOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createCategory} disabled={!newCategoryTitle.trim()}>
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </RoleGate>
          </TabsContent>
          
          <TabsContent value="tags" className="space-y-3">
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {allTags.map(tag => (
                  <Button
                    key={tag.id}
                    variant={selectedTags.includes(tag.slug) ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => toggleTag(tag.slug)}
                  >
                    <Tag className="w-3 h-3 mr-2" />
                    {tag.title}
                  </Button>
                ))}
              </div>
            </div>
            
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedTags.map(tagSlug => {
                    const tag = allTags.find(t => t.slug === tagSlug);
                    return (
                      <Badge key={tagSlug} variant="secondary" className="text-xs">
                        {tag?.title || tagSlug}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            
            <RoleGate roles={['admin']}>
              <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    New Tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Tag</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={newTagTitle}
                        onChange={(e) => setNewTagTitle(e.target.value)}
                        placeholder="Tag title"
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsCreateTagOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createTag} disabled={!newTagTitle.trim()}>
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </RoleGate>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}