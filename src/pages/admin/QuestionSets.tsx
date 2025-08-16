import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { 
  ChevronDown, 
  ChevronRight, 
  Plus,
  Trash2,
  Save,
  Upload,
  FileText,
  BookOpen,
  Tag,
  Link
} from "lucide-react";
import { EXAMS } from "@/lib/curricula";

interface TreeNode {
  id: string;
  title: string;
  type: 'exam' | 'curriculum' | 'topic' | 'kb_item';
  description?: string;
  children: TreeNode[];
  expanded?: boolean;
  exam_enum?: string;
  tags?: string[];
  linked_exam?: string;
  linked_curriculum?: string;
  link_url?: string;
  reference?: string;
}

export default function QuestionSetsAdmin() {
  const { toast } = useToast();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states for the details panel
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formExamEnum, setFormExamEnum] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formLinkedExam, setFormLinkedExam] = useState("");
  const [formLinkedCurriculum, setFormLinkedCurriculum] = useState("");
  const [formLinkUrl, setFormLinkUrl] = useState("");
  const [formReference, setFormReference] = useState("");

  // Auto-save functionality
  useEffect(() => {
    if (!selectedNode) return;
    
    const timeoutId = setTimeout(() => {
      saveNodeChanges();
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [formTitle, formDescription, formExamEnum, formTags, formLinkedExam, formLinkedCurriculum, formLinkUrl, formReference]);

  useEffect(() => {
    document.title = "Database | Admin | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Manage curriculum tree structure for exams, SLOs, topics, and knowledge base.");
  }, []);

  const loadTreeData = async () => {
    setLoading(true);
    try {
      // For now, we'll create a mock tree structure
      // In a real implementation, this would fetch from multiple tables and build the hierarchy
      const mockData: TreeNode[] = [
        {
          id: "exam-1",
          title: "MRCEM Primary",
          type: "exam",
          exam_enum: "MRCEM_PRIMARY",
          expanded: true,
          children: [
            {
              id: "curriculum-1",
              title: "Basic Sciences",
              type: "curriculum",
              description: "Fundamental medical sciences",
              linked_exam: "MRCEM_PRIMARY",
              expanded: false,
              children: [
                {
                  id: "topic-1",
                  title: "Anatomy",
                  type: "topic",
                  tags: ["anatomy", "basic-sciences"],
                  linked_curriculum: "curriculum-1",
                  children: [
                    {
                      id: "kb-1",
                      title: "Gray's Anatomy Reference",
                      type: "kb_item",
                      link_url: "https://example.com/grays-anatomy",
                      reference: "Gray's Anatomy Ch. 1-5",
                      children: []
                    }
                  ]
                },
                {
                  id: "topic-2",
                  title: "Physiology",
                  type: "topic",
                  tags: ["physiology", "basic-sciences"],
                  linked_curriculum: "curriculum-1",
                  children: []
                }
              ]
            }
          ]
        }
      ];
      setTreeData(mockData);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTreeData(); }, []);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'exam': return <span className="text-lg">🎓</span>;
      case 'curriculum': return <span className="text-lg">📚</span>;
      case 'topic': return <span className="text-lg">🏷️</span>;
      case 'kb_item': return <span className="text-lg">🔗</span>;
      default: return null;
    }
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setTreeData(updateNode(treeData));
  };

  const selectNode = (node: TreeNode) => {
    setSelectedNode(node);
    setFormTitle(node.title);
    setFormDescription(node.description || "");
    setFormExamEnum(node.exam_enum || "");
    setFormTags(node.tags?.join(", ") || "");
    setFormLinkedExam(node.linked_exam || "");
    setFormLinkedCurriculum(node.linked_curriculum || "");
    setFormLinkUrl(node.link_url || "");
    setFormReference(node.reference || "");
  };

  const saveNodeChanges = async () => {
    if (!selectedNode) return;
    
    // Validation guards
    if (!formTitle.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }
    
    if (selectedNode.type === 'kb_item' && !formReference.trim()) {
      toast({ title: 'Error', description: 'Reference is required for KB items', variant: 'destructive' });
      return;
    }
    
    // Update the node in the tree
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            title: formTitle.trim(),
            description: formDescription.trim() || undefined,
            exam_enum: formExamEnum || undefined,
            tags: formTags ? formTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
            linked_exam: formLinkedExam === "none" ? undefined : formLinkedExam,
            linked_curriculum: formLinkedCurriculum === "none" ? undefined : formLinkedCurriculum,
            link_url: formLinkUrl.trim() || undefined,
            reference: formReference.trim() || undefined
          };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    
    setTreeData(updateNode(treeData));
    setSelectedNode(prev => prev ? { ...prev, title: formTitle.trim() } : null);
    toast({ title: 'Saved', description: 'Changes saved successfully.' });
  };

  const addNewNode = (parentId: string | null, type: 'exam' | 'curriculum' | 'topic' | 'kb_item') => {
    const newNode: TreeNode = {
      id: `${type}-${Date.now()}`,
      title: `New ${type}`,
      type,
      children: [],
      expanded: false
    };

    if (parentId === null) {
      // Add as root level
      setTreeData([...treeData, newNode]);
    } else {
      // Add to parent
      const addToParent = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            return { ...node, children: [...node.children, newNode], expanded: true };
          }
          if (node.children.length > 0) {
            return { ...node, children: addToParent(node.children) };
          }
          return node;
        });
      };
      setTreeData(addToParent(treeData));
    }
    
    setSelectedNode(newNode);
    setFormTitle(newNode.title);
    setFormDescription("");
    setFormExamEnum("");
    setFormTags("");
    setFormLinkedExam("");
    setFormLinkedCurriculum("");
    setFormLinkUrl("");
    setFormReference("");
  };

  const deleteNode = (nodeId: string) => {
    const removeNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.filter(node => node.id !== nodeId).map(node => ({
        ...node,
        children: removeNode(node.children)
      }));
    };
    
    setTreeData(removeNode(treeData));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
    toast({ title: 'Deleted', description: 'Node deleted successfully.' });
  };

  const renderTreeNode = (node: TreeNode, level = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = node.expanded;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id} className="w-full">
        <div 
          className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer hover:bg-accent/50 ${
            isSelected ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => selectNode(node)}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(node.id);
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          {getNodeIcon(node.type)}
          <span className="text-sm font-medium">{node.title}</span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                if (node.type !== 'kb_item') addNewNode(node.id, 'topic');
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) return nodes;
    
    return nodes.filter(node => {
      const matchesTitle = node.title.toLowerCase().includes(term.toLowerCase());
      const hasMatchingChildren = node.children.length > 0 && filterTree(node.children, term).length > 0;
      return matchesTitle || hasMatchingChildren;
    }).map(node => ({
      ...node,
      children: filterTree(node.children, term),
      expanded: true // Expand matching nodes
    }));
  };

  const filteredTree = filterTree(treeData, searchTerm);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Curriculum Database</h1>
          <Button variant="outline" onClick={loadTreeData} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Tree Editor */}
          <Card className="p-4 space-y-4 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Curriculum Tree</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addNewNode(null, 'exam')}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Add Exam</span>
                  <span className="sm:hidden">Exam</span>
                </Button>
              </div>
            </div>
            
            <Input
              placeholder="Search curriculum..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />

            <div className="flex-1 overflow-y-auto border rounded p-2">
              {filteredTree.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No curriculum structure found. Start by adding an Exam node.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTree.map(node => renderTreeNode(node))}
                </div>
              )}
            </div>
          </Card>

          {/* Right Panel - Details */}
          <Card className="p-4 space-y-4 overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold">
              {selectedNode ? `Edit ${selectedNode.type}` : 'Select a node to edit'}
            </h2>

            {selectedNode ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getNodeIcon(selectedNode.type)}
                  <Badge variant="outline">{selectedNode.type}</Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="node-title">Title</Label>
                    <Input
                      id="node-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Enter title"
                    />
                  </div>

                  {selectedNode.type !== 'kb_item' && (
                    <div>
                      <Label htmlFor="node-description">Description</Label>
                      <Textarea
                        id="node-description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Enter description"
                        rows={3}
                      />
                    </div>
                  )}

                  {selectedNode.type === 'exam' && (
                    <div>
                      <Label htmlFor="exam-enum">Exam Type</Label>
                      <Select value={formExamEnum} onValueChange={setFormExamEnum}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exam type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXAMS.map(exam => (
                            <SelectItem key={exam} value={exam.replace(' ', '_').toUpperCase()}>
                              {exam}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedNode.type === 'topic' && (
                    <div>
                      <Label htmlFor="topic-tags">Tags (comma-separated)</Label>
                      <Input
                        id="topic-tags"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="anatomy, basic-sciences, mrcem"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'curriculum' && (
                    <div>
                      <Label htmlFor="linked-exam">Linked Exam</Label>
                      <Select value={formLinkedExam} onValueChange={setFormLinkedExam}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select linked exam" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {EXAMS.map(exam => (
                            <SelectItem key={exam} value={exam.replace(' ', '_').toUpperCase()}>
                              {exam}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedNode.type === 'kb_item' && (
                    <>
                      <div>
                        <Label htmlFor="kb-url">Link URL</Label>
                        <Input
                          id="kb-url"
                          value={formLinkUrl}
                          onChange={(e) => setFormLinkUrl(e.target.value)}
                          placeholder="https://example.com/resource"
                        />
                      </div>
                      <div>
                        <Label htmlFor="kb-reference">Reference (for Generator)</Label>
                        <Input
                          id="kb-reference"
                          value={formReference}
                          onChange={(e) => setFormReference(e.target.value)}
                          placeholder="Gray's Anatomy Ch. 1-5"
                        />
                      </div>
                    </>
                  )}
                </div>

                 <div className="flex gap-2 pt-4">
                  <Button onClick={saveNodeChanges} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  {selectedNode.type !== 'kb_item' && (
                    <Button 
                      variant="outline" 
                      onClick={() => addNewNode(selectedNode.id, 'kb_item')}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Add KB Item
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a node from the tree to view and edit its details.
              </div>
            )}
          </Card>
        </div>
      </main>
      <Footer />
      <link rel="canonical" href={`${window.location.origin}/admin/database`} />
    </div>
  );
}
