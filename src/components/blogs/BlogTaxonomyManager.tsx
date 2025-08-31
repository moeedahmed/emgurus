import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderOpen, Folder, Tag } from "lucide-react";

interface Category {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  post_count?: number;
  children?: Category[];
}

interface BlogTag {
  id: string;
  title: string;
  slug: string;
  post_count?: number;
}

export default function BlogTaxonomyManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Category dialogs
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Tag dialogs
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
  
  // Form states
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [newTagTitle, setNewTagTitle] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load categories with post counts
      const { data: cats, error: catsError } = await supabase
        .from('blog_categories')
        .select(`
          id, title, slug, parent_id,
          posts:blog_posts(count)
        `)
        .order('title');
        
      if (catsError) throw catsError;
      
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

      // Load tags with post counts
      const { data: tagsData, error: tagsError } = await supabase
        .from('blog_tags')
        .select(`
          id, title, slug,
          posts:blog_post_tags(count)
        `)
        .order('title');
        
      if (tagsError) throw tagsError;
      
      const tagsWithCounts = (tagsData || []).map((tag: any) => ({
        ...tag,
        post_count: tag.posts?.[0]?.count || 0,
      }));
      
      setTags(tagsWithCounts);
    } catch (error) {
      console.error('Failed to load data:', error);
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
          parent_id: newCategoryParentId,
        });
        
      if (error) throw error;
      
      toast.success('Category created');
      setNewCategoryTitle("");
      setNewCategoryParentId(null);
      setIsCreateCategoryOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !newCategoryTitle.trim()) return;
    
    try {
      const slug = newCategoryTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_categories')
        .update({
          title: newCategoryTitle.trim(),
          slug,
          name: newCategoryTitle.trim(),
          parent_id: newCategoryParentId,
        })
        .eq('id', editingCategory.id);
        
      if (error) throw error;
      
      toast.success('Category updated');
      setEditingCategory(null);
      setNewCategoryTitle("");
      setNewCategoryParentId(null);
      setIsEditCategoryOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error('Failed to update category');
    }
  };

  const deleteCategory = async (category: Category) => {
    if (category.post_count && category.post_count > 0) {
      toast.error(`Cannot delete category in use by ${category.post_count} posts`);
      return;
    }
    
    if (category.children && category.children.length > 0) {
      toast.error('Cannot delete category with subcategories');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('blog_categories')
        .delete()
        .eq('id', category.id);
        
      if (error) throw error;
      
      toast.success('Category deleted');
      loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
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

  const updateTag = async () => {
    if (!editingTag || !newTagTitle.trim()) return;
    
    try {
      const slug = newTagTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_tags')
        .update({
          title: newTagTitle.trim(),
          slug,
        })
        .eq('id', editingTag.id);
        
      if (error) throw error;
      
      toast.success('Tag updated');
      setEditingTag(null);
      setNewTagTitle("");
      setIsEditTagOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to update tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const deleteTag = async (tag: BlogTag) => {
    if (tag.post_count && tag.post_count > 0) {
      toast.error(`Cannot delete tag in use by ${tag.post_count} posts`);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('blog_tags')
        .delete()
        .eq('id', tag.id);
        
      if (error) throw error;
      
      toast.success('Tag deleted');
      loadData();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('Failed to delete tag');
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

  const filteredCategories = categories.filter(cat => 
    cat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTags = tags.filter(tag => 
    tag.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const renderCategory = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    
    return (
      <div key={category.id}>
        <div className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded ${level > 0 ? 'ml-6' : ''}`}>
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          ) : (
            <div className="w-6" />
          )}
          
          {hasChildren ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )}
          
          <span className="flex-1 font-medium">{category.title}</span>
          
          {category.post_count !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {category.post_count} posts
            </Badge>
          )}
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingCategory(category);
                setNewCategoryTitle(category.title);
                setNewCategoryParentId(category.parent_id);
                setIsEditCategoryOpen(true);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={category.post_count > 0 || (category.children && category.children.length > 0)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{category.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteCategory(category)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {category.children?.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <Card className="p-6 h-96 animate-pulse" />;
  }

  const flatCategories = flattenCategories(categories);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Manage blog categories, subcategories, and tags. Items with posts cannot be deleted.
      </div>
      
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            
            <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Category
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
                    <Select value={newCategoryParentId || undefined} onValueChange={(value) => setNewCategoryParentId(value === 'none' ? null : value)}>
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
          </div>
          
          <Card className="p-4">
            <div className="space-y-1">
              {filteredCategories.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No categories found
                </div>
              ) : (
                filteredCategories.map(category => renderCategory(category))
              )}
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="tags" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            
            <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tag
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
          </div>
          
          <Card className="p-4">
            <div className="space-y-2">
              {filteredTags.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No tags found
                </div>
              ) : (
                filteredTags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 font-medium">{tag.title}</span>
                    
                    {tag.post_count !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {tag.post_count} posts
                      </Badge>
                    )}
                    
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTag(tag);
                          setNewTagTitle(tag.title);
                          setIsEditTagOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={tag.post_count > 0}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{tag.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTag(tag)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
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
              <Select value={newCategoryParentId || undefined} onValueChange={(value) => setNewCategoryParentId(value === 'none' ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (top level)</SelectItem>
                  {flatCategories
                    .filter(cat => cat.id !== editingCategory?.id) // Don't allow self as parent
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {'  '.repeat(cat.level)}{cat.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditCategoryOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateCategory} disabled={!newCategoryTitle.trim()}>
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={isEditTagOpen} onOpenChange={setIsEditTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
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
              <Button variant="outline" onClick={() => setIsEditTagOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateTag} disabled={!newTagTitle.trim()}>
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}