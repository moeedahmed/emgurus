import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderOpen, Folder } from "lucide-react";

interface Category {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  post_count?: number;
  children?: Category[];
}

export default function BlogTaxonomyManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      setLoading(true);
      
      // Load categories with post counts
      const { data: cats, error } = await supabase
        .from('blog_categories')
        .select(`
          id, title, slug, parent_id,
          posts:blog_posts(count)
        `)
        .order('title');
        
      if (error) throw error;
      
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
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const createCategory = async () => {
    if (!newTitle.trim()) return;
    
    try {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_categories')
        .insert({
          title: newTitle.trim(),
          slug,
          name: newTitle.trim(),
          parent_id: newParentId,
        });
        
      if (error) throw error;
      
      toast.success('Category created');
      setNewTitle("");
      setNewParentId(null);
      setIsCreateOpen(false);
      loadCategories();
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !newTitle.trim()) return;
    
    try {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from('blog_categories')
        .update({
          title: newTitle.trim(),
          slug,
          name: newTitle.trim(),
          parent_id: newParentId,
        })
        .eq('id', editingCategory.id);
        
      if (error) throw error;
      
      toast.success('Category updated');
      setEditingCategory(null);
      setNewTitle("");
      setNewParentId(null);
      setIsEditOpen(false);
      loadCategories();
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
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
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
                setNewTitle(category.title);
                setNewParentId(category.parent_id);
                setIsEditOpen(true);
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
        Manage blog categories and subcategories. Categories with posts cannot be deleted.
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create
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
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Category title"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Parent Category (optional)</Label>
                <Select value={newParentId || undefined} onValueChange={(value) => setNewParentId(value === 'none' ? null : value)}>
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
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createCategory} disabled={!newTitle.trim()}>
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
      
      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Category title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Parent Category (optional)</Label>
              <Select value={newParentId || undefined} onValueChange={(value) => setNewParentId(value === 'none' ? null : value)}>
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
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateCategory} disabled={!newTitle.trim()}>
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}