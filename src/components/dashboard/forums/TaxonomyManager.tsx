import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

interface Category {
  id: string;
  title: string;  // forum_categories uses 'title' not 'name'
  description: string | null;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export default function TaxonomyManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [activeTab, setActiveTab] = useState<'categories' | 'topics' | 'usage'>('categories');

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, topicRes, usageRes] = await Promise.all([
        supabase.from('forum_categories').select('*').order('title'),
        // For topics, we'll use a placeholder since forum topics might not exist yet
        Promise.resolve({ data: [] }),
        // Usage calculation - placeholder since forum-category mapping might not exist yet
        Promise.resolve({ data: [] })
      ]);

      setCategories(catRes.data || []);
      setTopics(topicRes.data || []);
      
      // Calculate usage counts from forum threads
      const { data: threadCounts } = await supabase
        .from('forum_threads')
        .select('category_id')
        .not('category_id', 'is', null);
        
      const usageCounts: Record<string, number> = {};
      (threadCounts || []).forEach((thread: any) => {
        if (thread.category_id) {
          usageCounts[thread.category_id] = (usageCounts[thread.category_id] || 0) + 1;
        }
      });
      setUsage(usageCounts);
    } catch (error: any) {
      toast({ title: "Failed to load data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('forum_categories')
        .insert({ title: newCategoryName, description: null });
      
      if (error) throw error;
      
      toast({ title: "Category created" });
      setNewCategoryName("");
      loadData();
    } catch (error: any) {
      toast({ title: "Failed to create category", description: error.message, variant: "destructive" });
    }
  };

  const updateCategory = async (category: Category, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('forum_categories')
        .update({ title: newName })
        .eq('id', category.id);
      
      if (error) throw error;
      
      toast({ title: "Category updated" });
      setEditingCategory(null);
      loadData();
    } catch (error: any) {
      toast({ title: "Failed to update category", description: error.message, variant: "destructive" });
    }
  };

  const deleteCategory = async (category: Category) => {
    if (usage[category.id] > 0) {
      toast({ title: "Cannot delete", description: `Category is used by ${usage[category.id]} threads`, variant: "destructive" });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('forum_categories')
        .delete()
        .eq('id', category.id);
      
      if (error) throw error;
      
      toast({ title: "Category deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Failed to delete category", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-0">
      <div className="flex gap-2 mb-6 px-6 pt-4">
        {[
          { id: 'categories' as const, label: 'Categories' },
          { id: 'topics' as const, label: 'Topics' },
          { id: 'usage' as const, label: 'Usage' },
        ].map(tab => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <div className="space-y-4 px-6">
          <div className="flex items-center gap-2">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createCategory()}
            />
            <Button onClick={createCategory} disabled={!newCategoryName.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.title}</TableCell>
                    <TableCell className="text-muted-foreground">forum/{category.id}</TableCell>
                    <TableCell>{usage[category.id] || 0} threads</TableCell>
                    <TableCell className="space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setEditingCategory(category)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Category</DialogTitle>
                          </DialogHeader>
                          <Input
                            defaultValue={category.title}
                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, title: e.target.value } : null)}
                          />
                          <DialogFooter>
                            <Button
                              onClick={() => editingCategory && updateCategory(category, editingCategory.title)}
                            >
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={usage[category.id] > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCategory(category)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      {loading ? "Loading..." : "No categories yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="space-y-4 px-6">
          <div className="p-4">
            <Card className="p-6 text-sm text-muted-foreground">
              Forum topic mapping not wired yet. Category management is available above.
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="space-y-4 px-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Thread Count</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.title}</TableCell>
                    <TableCell>{usage[category.id] || 0}</TableCell>
                    <TableCell>
                      {usage[category.id] > 0 ? (
                        <span className="text-green-600">In use</span>
                      ) : (
                        <span className="text-muted-foreground">Unused</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No categories to analyze.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}