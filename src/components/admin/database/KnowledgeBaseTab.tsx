import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";

interface KnowledgeBase {
  id: string;
  title: string;
  content?: string;
  file_url?: string;
  exam_type: string;
  created_at: string;
  updated_at: string;
  question_count?: number;
  linked_terms?: string[];
  linked_slos?: string[];
}

interface TaxonomyTerm {
  id: string;
  title: string;
  kind: string;
}

interface CurriculumSlo {
  id: string;
  code: string;
  title: string;
}

const KnowledgeBaseTab = () => {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeBase[]>([]);
  const [taxonomyTerms, setTaxonomyTerms] = useState<TaxonomyTerm[]>([]);
  const [curriculumSlos, setCurriculumSlos] = useState<CurriculumSlo[]>([]);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBase | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    exam_type: "MRCEM_PRIMARY",
    linked_terms: [] as string[],
    linked_slos: [] as string[]
  });

  const examTypes = ["MRCEM_PRIMARY", "MRCEM_SBA", "FRCEM_SBA", "FCPS_PART1", "FCPS_IMM", "FCPS_PART2", "OTHER"];

  useEffect(() => {
    loadData();
  }, [selectedExamFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load knowledge base items
      let kbQuery = supabase.from('knowledge_base').select('*').order('updated_at', { ascending: false });
      if (selectedExamFilter) {
        kbQuery = kbQuery.eq('exam_type', selectedExamFilter as any);
      }
      const { data: kbData } = await kbQuery;

      // Load linked terms and SLOs for each KB item
      const itemsWithLinks = await Promise.all(
        (kbData || []).map(async (item) => {
          // Get linked terms
          const { data: termLinks } = await supabase
            .from('knowledge_base_terms')
            .select('taxonomy_terms(id, title)')
            .eq('kb_id', item.id);
          
          // Get linked SLOs
          const { data: sloLinks } = await supabase
            .from('knowledge_base_slos')
            .select('curriculum_slos(id, code, title)')
            .eq('kb_id', item.id);

          // Get question usage count (simplified - would need actual question linking)
          const question_count = 0; // Placeholder

          return {
            ...item,
            question_count,
            linked_terms: termLinks?.map(link => (link as any).taxonomy_terms?.title || '') || [],
            linked_slos: sloLinks?.map(link => (link as any).curriculum_slos?.code || '') || []
          };
        })
      );
      setKnowledgeItems(itemsWithLinks);

      // Load taxonomy terms for linking
      const { data: termsData } = await supabase
        .from('taxonomy_terms')
        .select('id, title, kind')
        .order('title');
      setTaxonomyTerms(termsData || []);

      // Load curriculum SLOs for linking
      const { data: slosData } = await supabase
        .from('curriculum_slos')
        .select('id, code, title')
        .order('code');
      setCurriculumSlos(slosData || []);
    } catch (error: any) {
      toast({
        title: "Failed to load knowledge base data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);
      
      const fileName = `kb/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('blog-covers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-covers')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "File upload failed",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      const itemData = {
        title: formData.title,
        content: formData.content || null,
        exam_type: formData.exam_type as any
      };

      let itemId: string;

      if (editingItem) {
        const { error } = await supabase
          .from('knowledge_base')
          .update(itemData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        itemId = editingItem.id;
        toast({ title: "Knowledge base item updated successfully" });
      } else {
        const { data, error } = await supabase
          .from('knowledge_base')
          .insert(itemData)
          .select()
          .single();
        
        if (error) throw error;
        itemId = data.id;
        toast({ title: "Knowledge base item created successfully" });
      }

      // Update linked terms
      await supabase.from('knowledge_base_terms').delete().eq('kb_id', itemId);
      if (formData.linked_terms.length > 0) {
        const termLinks = formData.linked_terms.map(termId => ({ 
          kb_id: itemId, 
          term_id: termId 
        }));
        await supabase.from('knowledge_base_terms').insert(termLinks);
      }

      // Update linked SLOs
      await supabase.from('knowledge_base_slos').delete().eq('kb_id', itemId);
      if (formData.linked_slos.length > 0) {
        const sloLinks = formData.linked_slos.map(sloId => ({ 
          kb_id: itemId, 
          slo_id: sloId 
        }));
        await supabase.from('knowledge_base_slos').insert(sloLinks);
      }

      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to save knowledge base item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this knowledge base item?")) return;

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      toast({ title: "Knowledge base item deleted successfully" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to delete knowledge base item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      exam_type: "MRCEM_PRIMARY",
      linked_terms: [],
      linked_slos: []
    });
  };

  const openDialog = async (item?: KnowledgeBase) => {
    if (item) {
      setEditingItem(item);
      
      // Get linked terms and SLOs
      const [termsRes, slosRes] = await Promise.all([
        supabase.from('knowledge_base_terms').select('term_id').eq('kb_id', item.id),
        supabase.from('knowledge_base_slos').select('slo_id').eq('kb_id', item.id)
      ]);

      setFormData({
        title: item.title,
        content: item.content || "",
        exam_type: item.exam_type,
        linked_terms: termsRes.data?.map(link => link.term_id) || [],
        linked_slos: slosRes.data?.map(link => link.slo_id) || []
      });
    } else {
      setEditingItem(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const toggleTermLink = (termId: string) => {
    setFormData(prev => ({
      ...prev,
      linked_terms: prev.linked_terms.includes(termId)
        ? prev.linked_terms.filter(id => id !== termId)
        : [...prev.linked_terms, termId]
    }));
  };

  const toggleSloLink = (sloId: string) => {
    setFormData(prev => ({
      ...prev,
      linked_slos: prev.linked_slos.includes(sloId)
        ? prev.linked_slos.filter(id => id !== sloId)
        : [...prev.linked_slos, sloId]
    }));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Attach URLs/files and map to exams, topics, and SLOs.
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Chip
          name="exam-filter"
          value=""
          selected={selectedExamFilter === ""}
          onSelect={() => setSelectedExamFilter("")}
          variant="outline"
          size="sm"
        >
          All Exams
        </Chip>
        {examTypes.map((exam) => (
          <Chip
            key={exam}
            name="exam-filter"
            value={exam}
            selected={selectedExamFilter === exam}
            onSelect={() => setSelectedExamFilter(exam)}
            variant="outline"
            size="sm"
          >
            {exam.replace('_', ' ')}
          </Chip>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Knowledge Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Knowledge Base Item" : "Add Knowledge Base Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter title"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Exam Type *</label>
                <Select 
                  value={formData.exam_type} 
                  onValueChange={(value) => setFormData({ ...formData, exam_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes.map((exam) => (
                      <SelectItem key={exam} value={exam}>
                        {exam.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Content/Notes</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter content or notes"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium">File Upload</label>
                <div className="mt-1">
                  <input
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = await handleFileUpload(file);
                        if (url) {
                          // For now, just add to content. In real implementation, 
                          // you'd set file_url field
                          setFormData(prev => ({
                            ...prev,
                            content: prev.content + `\n\nFile: ${url}`
                          }));
                        }
                      }
                    }}
                    disabled={uploadingFile}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                  />
                  {uploadingFile && <div className="text-sm text-muted-foreground mt-1">Uploading...</div>}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Linked Topics</label>
                <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2">
                  <div className="flex flex-wrap gap-1">
                    {taxonomyTerms.filter(term => term.kind === 'topic').map((term) => (
                      <Chip
                        key={term.id}
                        name="linked-terms"
                        value={term.id}
                        selected={formData.linked_terms.includes(term.id)}
                        onSelect={() => toggleTermLink(term.id)}
                        variant="outline"
                        size="sm"
                      >
                        {term.title}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Linked SLOs</label>
                <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2">
                  <div className="flex flex-wrap gap-1">
                    {curriculumSlos.map((slo) => (
                      <Chip
                        key={slo.id}
                        name="linked-slos"
                        value={slo.id}
                        selected={formData.linked_slos.includes(slo.id)}
                        onSelect={() => toggleSloLink(slo.id)}
                        variant="outline"
                        size="sm"
                      >
                        {slo.code}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveItem} disabled={!formData.title}>
                  {editingItem ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Knowledge Base Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Exam Type</TableHead>
              <TableHead>Linked Topics</TableHead>
              <TableHead>Linked SLOs</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6">Loading...</TableCell>
              </TableRow>
            ) : knowledgeItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No knowledge base items found
                </TableCell>
              </TableRow>
            ) : (
              knowledgeItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.file_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.exam_type.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.linked_terms?.slice(0, 2).map((term, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                      {(item.linked_terms?.length || 0) > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(item.linked_terms?.length || 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.linked_slos?.slice(0, 2).map((slo, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-mono">
                          {slo}
                        </Badge>
                      ))}
                      {(item.linked_slos?.length || 0) > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(item.linked_slos?.length || 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.question_count > 0 ? (
                      <Badge variant="secondary">{item.question_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openDialog(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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

export default KnowledgeBaseTab;