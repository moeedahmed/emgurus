import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FolderTree, ChevronRight, ChevronDown, FolderOpen, Folder } from "lucide-react";
import { useRoles } from "@/hooks/useRoles";

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
  onCategoryChange: (categoryId: string | undefined) => void;
}

export default function BlogCategoryPanel({ 
  selectedCategoryId, 
  onCategoryChange
}: BlogCategoryPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { roles } = useRoles();
  const isAdmin = roles.includes('admin');
  const isGuru = roles.includes('guru');

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

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const renderCategoryTree = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    
    return (
      <div key={category.id}>
        <div 
          className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer ${
            isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
          } ${level > 0 ? 'ml-4' : ''}`}
          onClick={() => onCategoryChange(isSelected ? undefined : category.id)}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-5 h-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(category.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          
          {hasChildren ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )}
          
          <span className="flex-1 text-sm font-medium">{category.title}</span>
          
          {category.post_count !== undefined && category.post_count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {category.post_count}
            </Badge>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {category.children?.map(child => renderCategoryTree(child, level + 1))}
          </div>
        )}
      </div>
    );
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
        
        {/* Gurus and Admins see category tree */}
        {(isGuru || isAdmin) && (
          <div className="space-y-4">
            {/* Category Tree */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2">
                {categories.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    No categories available
                  </div>
                ) : (
                  categories.map(category => renderCategoryTree(category))
                )}
              </div>
              {selectedCategoryId && (
                <div className="text-xs text-muted-foreground">
                  Selected: {categories.find(c => c.id === selectedCategoryId)?.title || 
                    categories.flatMap(c => c.children || []).find(c => c.id === selectedCategoryId)?.title}
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          Taxonomy is managed in the Admin Dashboard
        </div>
      </div>
    </Card>
  );
}