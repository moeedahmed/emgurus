import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createDraft } from "@/lib/blogsApi";
import { ChevronDown, X, Plus, FileText, ExternalLink, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Guru {
  user_id: string;
  full_name: string;
}

interface BlogCategory {
  id: string;
  title: string;
  slug: string;
}

interface ContentBlock {
  type: 'text' | 'image_request' | 'video_placeholder';
  content?: string;
  description?: string;
}

interface GeneratedDraft {
  title: string;
  blocks: ContentBlock[];
  tags: string[];
}

interface SourceFile {
  name: string;
  content: string;
  size: number;
}

interface GenerationLog {
  ts: string;
  topic: string;
  instructions_text: string;
  urlCount: number;
  fileCount: number;
  contentChars?: number;
  success: boolean;
  error?: string;
}

export default function GenerateBlogDraft() {
  const { user, loading: userLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraft | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    instructions_text: ''
  });
  const [assignedGuru, setAssignedGuru] = useState('');
  
  // Source-related state
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  
  const { toast } = useToast();

  // Load gurus
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load gurus (users with guru role)
        const { data: guruRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'guru');
        
        if (guruRoles?.length) {
          const guruIds = guruRoles.map(r => r.user_id);
          const { data: guruProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', guruIds)
            .order('full_name');
          
          setGurus(guruProfiles || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [user]);

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading generator…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to use the blog generator.</div>;
  }

  const enrichTags = (baseTags: string[]): string[] => {
    const enrichments: Record<string, string[]> = {
      'sepsis': ['infection', 'critical care', 'antimicrobials'],
      'mi': ['cardiology', 'chest pain', 'ecg'],
      'stroke': ['neurology', 'tpa', 'imaging'],
      'trauma': ['emergency', 'resuscitation', 'surgery'],
      'copd': ['respiratory', 'nebulizer', 'steroids'],
      'asthma': ['bronchodilator', 'respiratory', 'allergy']
    };

    const enriched = new Set(baseTags);
    baseTags.forEach(tag => {
      const lower = tag.toLowerCase();
      Object.keys(enrichments).forEach(key => {
        if (lower.includes(key)) {
          enrichments[key].forEach(enrichTag => enriched.add(enrichTag));
        }
      });
    });

    return Array.from(enriched);
  };

  const handleUploadImage = async (blockIndex: number, file: File) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const path = `blog-generator/${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('blog-covers')
        .upload(path, file, { upsert: false });
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('blog-covers').getPublicUrl(path);
      
      // Update the block with the uploaded image
      setGeneratedDraft(prev => {
        if (!prev) return prev;
        const newBlocks = [...prev.blocks];
        newBlocks[blockIndex] = {
          type: 'text',
          content: `![${newBlocks[blockIndex].description || 'Medical illustration'}](${data.publicUrl})`
        };
        return { ...prev, blocks: newBlocks };
      });

      toast({
        title: "Image Uploaded",
        description: "Image has been uploaded successfully.",
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: "Unable to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async (blockIndex: number, description: string) => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('ai-route', {
        body: {
          purpose: 'image_generation',
          description: description
        }
      });

      if (response.error) throw new Error(response.error.message || 'Image generation failed');

      const result = response.data;
      
      if (result.success === true) {
        let imageMarkdown = '';
        
        // Handle both URL and base64 responses
        if (result.image_url) {
          imageMarkdown = `![${description}](${result.image_url})`;
        } else if (result.image_data) {
          imageMarkdown = `![${description}](data:image/png;base64,${result.image_data})`;
        } else {
          console.error('Image generation failed: No image data returned', result);
          throw new Error('Image generation returned no data');
        }

        // Update the block with the generated image
        setGeneratedDraft(prev => {
          if (!prev) return prev;
          const newBlocks = [...prev.blocks];
          newBlocks[blockIndex] = {
            type: 'text',
            content: imageMarkdown
          };
          return { ...prev, blocks: newBlocks };
        });

        toast({
          title: "Image Generated",
          description: "AI image has been generated successfully.",
        });
      } else if (result.success === false) {
        console.error('Image generation failed:', result);
        toast({
          title: "Generation Failed",
          description: result.error || "Unable to generate image. Please try again.",
          variant: "destructive"
        });
      } else {
        console.error('Unexpected response format:', result);
        toast({
          title: "Generation Failed", 
          description: "Unexpected response from server. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Unable to generate image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Source management functions
  const addUrl = () => {
    if (newUrl.trim() && !sourceUrls.includes(newUrl.trim())) {
      setSourceUrls([...sourceUrls, newUrl.trim()]);
      setNewUrl('');
    }
  };

  const removeUrl = (index: number) => {
    setSourceUrls(sourceUrls.filter((_, i) => i !== index));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.md'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 5;
    
    for (const file of files) {
      // Validate file type
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      
      if (!hasValidExtension) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not supported. Only .pdf, .docx, .pptx, .txt, and .md files are allowed.`,
          variant: "destructive"
        });
        continue;
      }

      // Validate file size (10MB limit)
      if (file.size > maxFileSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds 10MB limit.`,
          variant: "destructive"
        });
        continue;
      }

      // Check if already have 5 files
      if (sourceFiles.length >= maxFiles) {
        toast({
          title: "Too Many Files",
          description: "Maximum 5 files allowed.",
          variant: "destructive"
        });
        break;
      }

      // For text files, parse content client-side
      if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setSourceFiles(prev => [...prev, {
            name: file.name,
            content: content,
            size: file.size
          }]);
        };
        reader.readAsText(file);
      } else {
        // For other file types, store the file object for server-side processing
        setSourceFiles(prev => [...prev, {
          name: file.name,
          content: '', // Will be processed server-side
          size: file.size
        }]);
      }
    }

    // Reset input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setSourceFiles(sourceFiles.filter((_, i) => i !== index));
  };

  // Local logging functions
  const saveGenerationLog = (logEntry: GenerationLog) => {
    try {
      const existing = JSON.parse(localStorage.getItem('blogGen:history') || '[]');
      const updated = [logEntry, ...existing].slice(0, 5); // Keep only last 5
      localStorage.setItem('blogGen:history', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save generation log:', error);
    }
  };

  const getGenerationHistory = (): GenerationLog[] => {
    try {
      return JSON.parse(localStorage.getItem('blogGen:history') || '[]');
    } catch {
      return [];
    }
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for blog generation.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.instructions_text.trim()) {
      toast({
        title: "Missing Instructions",
        description: "Please describe what you want to include in the blog.",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    const startTime = new Date().toISOString();
    
    try {
      // Prepare source data
      const source_texts = sourceFiles
        .filter(f => f.content) // Only include files with parsed content
        .map(f => f.content);
      
      const response = await supabase.functions.invoke('ai-route', {
        body: {
          purpose: 'blog_generation',
          topic: formData.topic,
          instructions_text: formData.instructions_text,
          source_links: sourceUrls,
          source_files: sourceFiles // Send all files for server-side processing
        }
      });

      if (response.error) throw new Error(response.error.message || 'Generation failed');

      const result = response.data;
      
      // Check for backend success flag
      if (result.success === false) {
        throw new Error(result.error || 'Blog generation failed');
      }
      
      // Validate that backend returned expected structure
      if (!result || typeof result !== 'object' || !result.title) {
        throw new Error('Invalid response format from backend');
      }

      // Enrich AI-generated tags with medical context
      const enrichedTags = Array.isArray(result.tags) && result.tags.length > 0 
        ? enrichTags(result.tags) 
        : [];

      const generatedContent = {
        title: result.title,
        blocks: result.blocks,
        tags: enrichedTags
      };

      setGeneratedDraft(generatedContent);

      // Log successful generation
      const contentChars = result.blocks.reduce((acc: number, block: ContentBlock) => 
        acc + (block.content?.length || 0), 0);
      
      saveGenerationLog({
        ts: startTime,
        topic: formData.topic,
        instructions_text: formData.instructions_text,
        urlCount: sourceUrls.length,
        fileCount: sourceFiles.length,
        contentChars,
        success: true
      });

      toast({
        title: "Draft Generated",
        description: "AI blog draft has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating blog:', error);
      
      // Log failed generation
      saveGenerationLog({
        ts: startTime,
        topic: formData.topic,
        instructions_text: formData.instructions_text,
        urlCount: sourceUrls.length,
        fileCount: sourceFiles.length,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Generation Failed",
        description: "Unable to generate blog draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedDraft) return;
    
    setLoading(true);
    try {
      // Convert blocks to markdown for storage
      const content_md = generatedDraft.blocks.map(block => {
        switch (block.type) {
          case 'text':
            return block.content || '';
          case 'image_request':
            return `*[Image needed: ${block.description || 'Medical illustration'}]*`;
          case 'video_placeholder':
            return `*[Video placeholder: ${block.description || 'Educational video'}]*`;
          default:
            return '';
        }
      }).join('\n\n');

      // Create the draft - createDraft function automatically sets status='draft'
      // Category will be assigned later in the editor
      const { id } = await createDraft({
        title: generatedDraft.title,
        content_md: content_md,
        category_id: undefined, // No category assignment during generation
        tag_slugs: generatedDraft.tags
      });

      toast({
        title: "Draft Saved",
        description: "Blog draft has been saved successfully.",
      });

      // Reset form and generated content
      setFormData({
        topic: '',
        instructions_text: ''
      });
      setGeneratedDraft(null);
      setAssignedGuru('');
      setSourceUrls([]);
      setSourceFiles([]);
      
      return id;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save blog draft. Please try again.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToGuru = async () => {
    if (!generatedDraft || !assignedGuru) {
      toast({
        title: "Missing Assignment",
        description: "Please select a guru to assign this draft to.",
        variant: "destructive"
      });
      return;
    }

    try {
      // First save the draft if not already saved
      const draftId = await handleSaveDraft();
      
      if (draftId) {
        // Assign to guru by updating the post
        const { error: assignError } = await supabase
          .from('blog_posts')
          .update({ 
            author_id: assignedGuru
          })
          .eq('id', draftId);

        if (assignError) throw assignError;
        
        // Create assignment in blog_review_assignments table
        const response = await fetch(`https://cgtvvpzrzwyvsbavboxa.functions.supabase.co/blogs-api/api/blogs/${draftId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            reviewer_id: user.id, // Admin who generated it becomes reviewer
            note: 'Assigned via AI generation tool'
          })
        });
        
        if (!response.ok) {
          console.error('Failed to create review assignment');
        }

        toast({
          title: "Draft Assigned",
          description: "Blog draft has been assigned to the selected guru.",
        });
      }
    } catch (error) {
      console.error('Error assigning draft:', error);
      toast({
        title: "Assignment Failed",
        description: "Unable to assign blog draft. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleEditDraft = async () => {
    try {
      const draftId = await handleSaveDraft();
      if (draftId) {
        // Navigate to editor with the draft ID
        window.open(`/blogs/editor/${draftId}`, '_blank');
      }
    } catch (error) {
      // Error already handled in handleSaveDraft
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Blog Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Acute MI Management, Sepsis Protocols"
              />
            </div>

            <div>
              <Label htmlFor="instructions_text">What to include *</Label>
              <Textarea
                id="instructions_text"
                value={formData.instructions_text}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions_text: e.target.value }))}
                placeholder="Describe what you want in the blog — sections, keywords, tone, focus areas, or specific requirements."
                rows={4}
              />
            </div>

            {/* Sources Section */}
            <Collapsible open={!sourcesCollapsed} onOpenChange={setSourcesCollapsed}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-0 h-auto font-semibold"
                >
                  Sources (optional)
                  <ChevronDown className={`h-4 w-4 transition-transform ${sourcesCollapsed ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 mt-4">
                {/* URLs */}
                <div>
                  <Label className="text-sm font-medium">Links</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com/article"
                      onKeyPress={(e) => e.key === 'Enter' && addUrl()}
                    />
                    <Button onClick={addUrl} size="sm" disabled={!newUrl.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {sourceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sourceUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1 text-sm">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-32">{url}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => removeUrl(index)}
                            type="button"
                            aria-label="Remove URL"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* File Upload */}
                <div>
                  <Label htmlFor="draft-upload" className="text-sm font-medium">Supporting Documents</Label>
                  <div className="mt-1">
                    <input
                      id="draft-upload"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.pptx,.txt,.md"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload .pdf, .docx, .pptx, .txt, .md — max 10 MB each, up to 5 files
                    </p>
                  </div>
                  
                  {sourceFiles.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {sourceFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-secondary rounded-md px-2 py-1 text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(file.size / 1024)}KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => removeFile(index)}
                            type="button"
                            aria-label="Remove file"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Generation History Link */}
                <div className="flex justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                        <History className="h-3 w-3 mr-1" />
                        View last 5 runs
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Generation History</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {getGenerationHistory().map((log, index) => (
                          <div key={index} className="p-3 border rounded-md text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className={`px-2 py-1 rounded text-xs ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {log.success ? 'Success' : 'Failed'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.ts).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <strong>Topic:</strong> {log.topic}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              URLs: {log.urlCount} | Files: {log.fileCount} 
                              {log.contentChars && ` | Generated: ${log.contentChars} chars`}
                              {log.error && (
                                <div className="text-red-600 mt-1">Error: {log.error}</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {getGenerationHistory().length === 0 && (
                          <div className="text-center text-muted-foreground py-4">
                            No generation history yet
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button 
              onClick={handleGenerate} 
              disabled={generating || !formData.topic.trim() || !formData.instructions_text.trim()}
              className="w-full"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                'Generate Blog Draft'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview/Results */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Draft Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedDraft ? (
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <h2 className="text-xl font-semibold">{generatedDraft.title}</h2>
                </div>

                {/* Suggested Tags */}
                {generatedDraft.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Suggested Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {generatedDraft.tags.map((tag, index) => (
                        <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources Used */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Sources Used</h4>
                  {sourceUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {sourceUrls.map((url, index) => (
                        <a 
                          key={index}
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-secondary hover:bg-secondary/80 rounded-md px-2 py-1 text-sm transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-32">{url}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sources provided.</p>
                  )}
                </div>

                {/* Content Blocks */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Content Blocks</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {generatedDraft.blocks.map((block, index) => (
                      <Card key={index} className="border-l-4 border-l-primary/20">
                        <CardContent className="p-4">
                          {block.type === 'text' && (
                            <div className="prose prose-sm max-w-none">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                {block.content}
                              </p>
                            </div>
                          )}
                          {block.type === 'image_request' && (
                            <div className="border-2 border-dashed border-primary/30 p-4 rounded-lg text-center bg-primary/5">
                              <div className="text-sm font-medium text-primary mb-2 flex items-center justify-center gap-2">
                                📸 Image Request
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                {block.description || 'Medical illustration needed'}
                              </p>
                              <div className="flex gap-2 justify-center">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs"
                                  disabled={loading}
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) handleUploadImage(index, file);
                                    };
                                    input.click();
                                  }}
                                >
                                  Upload Image
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs"
                                  disabled={loading}
                                  onClick={() => handleGenerateImage(index, block.description || 'Medical illustration')}
                                >
                                  Generate with AI
                                </Button>
                              </div>
                            </div>
                          )}
                          {block.type === 'video_placeholder' && (
                            <div className="border-2 border-dashed border-secondary/30 p-4 rounded-lg bg-secondary/5">
                              <div className="text-sm font-medium text-secondary mb-2 flex items-center justify-center gap-2">
                                🎥 Video Placeholder
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                {block.description || 'Educational video content'}
                              </p>
                              <Input 
                                placeholder="Paste YouTube URL here..."
                                className="text-xs"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Assignment Section */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">Assign to Guru</Label>
                  <Select 
                    value={assignedGuru} 
                    onValueChange={setAssignedGuru}
                  >
                    <SelectTrigger className="mb-3">
                      <SelectValue placeholder="Select a guru to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {gurus.map(guru => (
                        <SelectItem key={guru.user_id} value={guru.user_id}>
                          {guru.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleSaveDraft} 
                    disabled={loading}
                    variant="outline"
                    size="sm"
                  >
                    {loading ? "Saving..." : "Save Draft"}
                  </Button>
                  
                  <Button 
                    onClick={handleAssignToGuru} 
                    disabled={loading || !assignedGuru}
                    size="sm"
                  >
                    Assign to Guru
                  </Button>
                  
                  <Button 
                    onClick={handleEditDraft} 
                    disabled={loading}
                    variant="secondary"
                    size="sm"
                  >
                    Edit Draft
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Generated blog draft will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}