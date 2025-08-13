import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaxonomyTerm {
  id: string;
  slug: string;
  title: string;
  kind: 'exam' | 'category' | 'topic' | 'specialty' | 'forum';
  description?: string;
  parent_id?: string;
  question_count?: number;
}

interface Breadcrumb {
  id: string;
  title: string;
  kind: string;
}

const ExamsTab = () => {
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTerm, setEditingTerm] = useState<TaxonomyTerm | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    kind: "exam" as TaxonomyTerm['kind']
  });

  useEffect(() => {
    loadTerms();
  }, [currentParentId]);

  const loadTerms = async () => {
    try {
      setLoading(true);
      
      // Load current level terms
      let query = supabase
        .from('taxonomy_terms')
        .select('id, slug, title, kind, description, parent_id')
        .order('kind')
        .order('title');

      if (currentParentId) {
        query = query.eq('parent_id', currentParentId);
      } else {
        query = query.is('parent_id', null);
      }

      const { data: termsData, error } = await query;
      
      if (error) throw error;

      // Get question counts for each term
      const termsWithCounts = await Promise.all(
        (termsData || []).map(async (term) => {
          const { count } = await supabase
            .from('taxonomy_question_terms')
            .select('*', { count: 'exact', head: true })
            .eq('term_id', term.id);
          
          return { ...term, question_count: count || 0 };
        })
      );

      setTerms(termsWithCounts);

      // Build breadcrumbs
      if (currentParentId) {
        await buildBreadcrumbs(currentParentId);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error: any) {
      toast({
        title: "Failed to load terms",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const buildBreadcrumbs = async (termId: string) => {
    try {
      const crumbs: Breadcrumb[] = [];
      let currentId: string | null = termId;

      while (currentId) {
        const { data, error } = await supabase
          .from('taxonomy_terms')
          .select('id, title, kind, parent_id')
          .eq('id', currentId)
          .single();

        if (error) throw error;
        
        crumbs.unshift({ id: data.id, title: data.title, kind: data.kind });
        currentId = data.parent_id;
      }

      setBreadcrumbs(crumbs);
    } catch (error: any) {
      console.error("Failed to build breadcrumbs:", error);
    }
  };

  const handleSaveTerm = async () => {
    try {
      const termData = {
        title: formData.title,
        slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: formData.description || null,
        kind: formData.kind,
        parent_id: currentParentId
      };

      if (editingTerm) {
        const { error } = await supabase
          .from('taxonomy_terms')
          .update(termData)
          .eq('id', editingTerm.id);
        
        if (error) throw error;
        toast({ title: "Term updated successfully" });
      } else {
        const { error } = await supabase
          .from('taxonomy_terms')
          .insert(termData);
        
        if (error) throw error;
        toast({ title: "Term created successfully" });
      }

      setDialogOpen(false);
      setEditingTerm(null);
      resetForm();
      loadTerms();
    } catch (error: any) {
      toast({
        title: "Failed to save term",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCloneExam = async () => {
    if (!cloneSourceId || !newTitle) return;

    try {
      // Clone the root exam term
      const { data: sourceExam, error: sourceError } = await supabase
        .from('taxonomy_terms')
        .select('*')
        .eq('id', cloneSourceId)
        .single();

      if (sourceError) throw sourceError;

      const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      // Create new root exam
      const { data: newExam, error: examError } = await supabase
        .from('taxonomy_terms')
        .insert({
          title: newTitle,
          slug: newSlug,
          description: sourceExam.description,
          kind: 'exam',
          parent_id: null
        })
        .select()
        .single();

      if (examError) throw examError;

      // Clone all descendants
      await cloneDescendants(cloneSourceId, newExam.id);

      toast({ title: "Exam cloned successfully" });
      setCloneDialogOpen(false);
      setCloneSourceId("");
      setNewTitle("");
      loadTerms();
    } catch (error: any) {
      toast({
        title: "Failed to clone exam",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const cloneDescendants = async (sourceParentId: string, newParentId: string) => {
    const { data: children, error } = await supabase
      .from('taxonomy_terms')
      .select('*')
      .eq('parent_id', sourceParentId);

    if (error) throw error;

    for (const child of children || []) {
      const newSlug = `${child.slug}-${Date.now()}`;
      
      const { data: newChild, error: childError } = await supabase
        .from('taxonomy_terms')
        .insert({
          title: child.title,
          slug: newSlug,
          description: child.description,
          kind: child.kind,
          parent_id: newParentId
        })
        .select()
        .single();

      if (childError) throw childError;

      // Recursively clone descendants
      await cloneDescendants(child.id, newChild.id);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", slug: "", description: "", kind: "exam" });
  };

  const openEditDialog = (term?: TaxonomyTerm) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        title: term.title,
        slug: term.slug,
        description: term.description || "",
        kind: term.kind
      });
    } else {
      setEditingTerm(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const navigateToTerm = (termId: string) => {
    setCurrentParentId(termId);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentParentId(null);
    } else {
      setCurrentParentId(breadcrumbs[index].id);
    }
  };

  const showQuestions = (termId: string) => {
    // This would open the existing admin question list with filters applied
    window.open(`/admin/marked-questions?term_id=${termId}`, '_blank');
  };

  const examTerms = terms.filter(t => t.kind === 'exam' && !currentParentId);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Manage exams and their areas/topics (taxonomy terms).
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <Chip
          name="breadcrumb"
          value="root"
          selected={currentParentId === null}
          onSelect={() => navigateToBreadcrumb(-1)}
          variant="outline"
          size="sm"
        >
          Root
        </Chip>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-2">
            <span className="text-muted-foreground">→</span>
            <Chip
              name="breadcrumb"
              value={crumb.id}
              selected={false}
              onSelect={() => navigateToBreadcrumb(index)}
              variant="outline"
              size="sm"
            >
              {crumb.title}
            </Chip>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTerm ? "Edit Term" : "Add Term"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Auto-generated from title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Kind</label>
                <Select value={formData.kind} onValueChange={(value: any) => setFormData({ ...formData, kind: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="topic">Topic</SelectItem>
                    <SelectItem value="specialty">Specialty</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveTerm}>
                  {editingTerm ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!currentParentId && (
          <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Clone Exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clone Exam Tree</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Source Exam</label>
                  <Select value={cloneSourceId} onValueChange={setCloneSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam to clone" />
                    </SelectTrigger>
                    <SelectContent>
                      {examTerms.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">New Exam Title</label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., FCPS Part 1 (PK)"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCloneExam} disabled={!cloneSourceId || !newTitle}>
                    Clone
                  </Button>
                  <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Terms Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">Loading...</TableCell>
              </TableRow>
            ) : terms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No terms found at this level
                </TableCell>
              </TableRow>
            ) : (
              terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span 
                        className="font-medium cursor-pointer hover:text-primary"
                        onClick={() => navigateToTerm(term.id)}
                      >
                        {term.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {term.kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {term.question_count > 0 ? (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer"
                        onClick={() => showQuestions(term.id)}
                      >
                        {term.question_count} questions
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                    {term.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openEditDialog(term)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default ExamsTab;