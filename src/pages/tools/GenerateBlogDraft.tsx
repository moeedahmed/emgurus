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
import { ChevronDown, X, Plus, FileText, ExternalLink, History, AlertTriangle, Search, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getErrorMessage, FieldError } from "@/lib/errors";

interface Guru {
  user_id: string;
  full_name: string;
  avatar_url?: string;
}

interface BlogCategory {
  id: string;
  title: string;
  slug: string;
}

interface ContentBlock {
  type: 'text' | 'heading' | 'image' | 'video' | 'audio' | 'quote' | 'divider';
  content?: string;
  description?: string;
  level?: string;
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

interface SourceError {
  source: string;
  error: string;
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
  const [selectedGurus, setSelectedGurus] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FieldError[]>([]);
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);
  
  // Source-related state
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [searchOnline, setSearchOnline] = useState(false);
  const [guruDropdownOpen, setGuruDropdownOpen] = useState(false);
  
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
          .select('user_id, full_name, avatar_url')
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

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  const validateBlocks = (blocks: ContentBlock[]): FieldError[] => {
    const errors: FieldError[] = [];
    let hasHeading = false;
    let hasText = false;

    blocks.forEach((block, index) => {
      if (block.type === 'heading') {
        if (!block.content?.trim()) {
          errors.push({ field: `heading_${index}`, message: "Heading cannot be empty" });
        } else {
          hasHeading = true;
        }
      }
      
      if (block.type === 'text') {
        if (!block.content?.trim()) {
          errors.push({ field: `text_${index}`, message: "Text block cannot be empty" });
        } else {
          hasText = true;
        }
      }
    });

    if (!hasHeading) {
      errors.push({ field: "content", message: "At least one heading is required" });
    }
    if (!hasText) {
      errors.push({ field: "content", message: "At least one text paragraph is required" });
    }

    // Check if we have tags from the current draft
    if (generatedDraft && generatedDraft.tags.length === 0) {
      errors.push({ field: "tags", message: "At least one tag is required" });
    }

    return errors;
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
      
      if (!data?.publicUrl) {
        throw new Error('No public URL returned from storage');
      }
      
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
        description: getErrorMessage(error) || "Unable to upload image. Please try again.",
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
      
      if (result.success === true && (result.image_url || result.image_data)) {
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

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Source management functions
  const addUrl = () => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) return;

    if (!isValidUrl(trimmedUrl)) {
      setUrlError('Please enter a valid URL (http:// or https://)');
      return;
    }

    if (sourceUrls.includes(trimmedUrl)) {
      setUrlError('This URL has already been added');
      return;
    }

    setSourceUrls([...sourceUrls, trimmedUrl]);
    setNewUrl('');
    setUrlError('');
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

    // Validate all URLs before submission
    const invalidUrls = sourceUrls.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      toast({
        title: "Invalid URLs",
        description: `Please fix the following invalid URLs: ${invalidUrls.join(', ')}`,
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
          source_files: sourceFiles, // Send all files for server-side processing
          browsing: searchOnline // Enable web search enrichment
        }
      });

      if (response.error) throw new Error(response.error.message || 'Generation failed');

      const result = response.data;
      
      // Check for backend success flag
      if (result.success === false) {
        throw new Error(result.error || 'Blog generation failed');
      }
      
      // Handle source errors
      if (result.source_errors && Array.isArray(result.source_errors)) {
        setSourceErrors(result.source_errors);
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
      setHasUnsavedChanges(true);

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
    
    // Validate blocks before saving
    const errors = validateBlocks(generatedDraft.blocks);
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted errors before saving.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      // Convert blocks to markdown for storage
      const content_md = generatedDraft.blocks.map(block => {
        switch (block.type) {
          case 'text':
            return block.content || '';
          case 'heading':
            const level = block.level === 'h3' ? '###' : '##';
            return `${level} ${block.content || ''}`;
          case 'image':
            return `*[Image needed: ${block.description || 'Medical illustration'}]*`;
          case 'video':
            return `*[Video placeholder: ${block.description || 'Educational video'}]*`;
          case 'audio':
            return `*[Audio placeholder: ${block.description || 'Audio content'}]*`;
          case 'quote':
            return `> ${block.content || ''}`;
          case 'divider':
            return '---';
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

      setHasUnsavedChanges(false);
      setValidationErrors([]);
      toast({
        title: "Draft Saved",
        description: "Blog draft has been saved successfully.",
      });

      return id;
    } catch (error) {
      console.error('Error saving draft:', error);
      
      // Handle structured errors from backend
      if (error && typeof error === 'object' && 'errors' in error) {
        setValidationErrors(error.errors as FieldError[]);
      }
      
      toast({
        title: "Save Failed",
        description: getErrorMessage(error, "Unable to save draft. Please try again."),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGurus = async () => {
    if (!generatedDraft || selectedGurus.length === 0) {
      toast({
        title: "Assignment Error",
        description: "Please generate a draft and select at least one guru.",
        variant: "destructive"
      });
      return;
    }

    // Validate blocks before assigning
    const errors = validateBlocks(generatedDraft.blocks);
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted errors before assigning.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // First save the draft
      const content_md = generatedDraft.blocks.map(block => {
        switch (block.type) {
          case 'text':
            return block.content || '';
          case 'heading':
            const level = block.level === 'h3' ? '###' : '##';
            return `${level} ${block.content || ''}`;
          case 'image':
            return `*[Image needed: ${block.description || 'Medical illustration'}]*`;
          case 'video':
            return `*[Video placeholder: ${block.description || 'Educational video'}]*`;
          case 'audio':
            return `*[Audio placeholder: ${block.description || 'Audio content'}]*`;
          case 'quote':
            return `> ${block.content || ''}`;
          case 'divider':
            return '---';
          default:
            return '';
        }
      }).join('\n\n');

      const { id } = await createDraft({
        title: generatedDraft.title,
        content_md: content_md,
        category_id: undefined,
        tag_slugs: generatedDraft.tags
      });

      // Call blogs API to handle multi-reviewer assignments
      const response = await supabase.functions.invoke('blogs-api', {
        body: {
          action: 'assign_reviewers',
          post_id: id,
          reviewer_ids: selectedGurus,
          note: "Blog draft assigned for multi-reviewer review"
        }
      });

      if (response.error) throw response.error;

      toast({
        title: "Draft Assigned",
        description: `Draft has been saved and assigned to ${selectedGurus.length} reviewer(s).`,
      });

      // Reset state
      setGeneratedDraft(null);
      setSelectedGurus([]);
      setFormData({ topic: '', instructions_text: '' });
      setSourceUrls([]);
      setSourceFiles([]);
      setHasUnsavedChanges(false);
      setValidationErrors([]);
      setSourceErrors([]);
    } catch (error) {
      console.error('Error assigning gurus:', error);
      
      // Handle structured errors from backend
      if (error && typeof error === 'object' && 'errors' in error) {
        setValidationErrors(error.errors as FieldError[]);
      }
      
      toast({
        title: "Assignment Failed",
        description: getErrorMessage(error, "Unable to assign draft. Please try again."),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setGeneratedDraft(null);
    setFormData({ topic: '', instructions_text: '' });
    setSourceUrls([]);
    setSourceFiles([]);
    setSelectedGurus([]);
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setSourceErrors([]);
  };

  const handleBlockChange = (blockIndex: number, newContent: string) => {
    if (!generatedDraft) return;
    
    const newBlocks = [...generatedDraft.blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], content: newContent };
    
    setGeneratedDraft({
      ...generatedDraft,
      blocks: newBlocks
    });
    setHasUnsavedChanges(true);
  };

  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message;
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Blog Generator</h1>
        <p className="text-muted-foreground">Generate AI-powered blog drafts and assign them for review.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Blog Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Errors Display */}
            {sourceErrors.length > 0 && (
              <div className="p-3 border border-destructive/20 rounded-md bg-destructive/5">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Source Processing Errors
                </div>
                {sourceErrors.map((error, index) => (
                  <div key={index} className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium">{error.source}:</span> {error.error}
                  </div>
                ))}
              </div>
            )}

            {/* Topic Input */}
            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="e.g., Acute MI management, Sepsis protocols..."
                className="mt-1"
              />
              {getFieldError('topic') && (
                <p className="text-xs text-destructive mt-1">{getFieldError('topic')}</p>
              )}
            </div>

            {/* Instructions */}
            <div>
              <Label htmlFor="instructions">Instructions *</Label>
              <Textarea
                id="instructions"
                value={formData.instructions_text}
                onChange={(e) => setFormData({ ...formData, instructions_text: e.target.value })}
                placeholder="Describe the key points to cover, target audience, style preferences..."
                className="mt-1 min-h-[100px]"
              />
              {getFieldError('instructions_text') && (
                <p className="text-xs text-destructive mt-1">{getFieldError('instructions_text')}</p>
              )}
            </div>

            {/* Sources Section */}
            <Collapsible open={!sourcesCollapsed} onOpenChange={setSourcesCollapsed}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Sources</span>
                    <span className="text-xs text-muted-foreground">
                      ({sourceFiles.length} files, {sourceUrls.length} URLs)
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${sourcesCollapsed ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-3">
                {/* File Upload */}
                <div>
                  <Label htmlFor="file-upload" className="text-sm font-medium">
                    Reference Files
                  </Label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.docx,.pptx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Files (.pdf, .docx, .pptx, .txt, .md)
                  </Button>
                  
                  {sourceFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sourceFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)}KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* URL Links */}
                <div>
                  <Label className="text-sm font-medium">Reference URLs</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newUrl}
                      onChange={(e) => {
                        setNewUrl(e.target.value);
                        if (urlError) setUrlError(''); // Clear error when typing
                      }}
                      placeholder="https://example.com/article"
                      onKeyPress={(e) => e.key === 'Enter' && addUrl()}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addUrl}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {urlError && (
                    <p className="text-xs text-destructive mt-1">{urlError}</p>
                  )}
                  
                  {sourceUrls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sourceUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate max-w-[250px]">{url}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUrl(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Online Toggle */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="search-online"
                    checked={searchOnline}
                    onCheckedChange={(checked) => setSearchOnline(checked === true)}
                  />
                  <Label htmlFor="search-online" className="text-sm">
                    Search online for additional context
                  </Label>
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

        {/* Generated Draft */}
        {generatedDraft && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <Input
                  value={generatedDraft.title}
                  onChange={(e) => {
                    setGeneratedDraft({ ...generatedDraft, title: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="mt-1"
                />
              </div>

              {/* Content Blocks */}
              <div>
                <Label className="text-sm font-medium">Content Blocks</Label>
                <div className="space-y-3 mt-2 max-h-96 overflow-y-auto">
                  {generatedDraft.blocks.map((block, index) => (
                    <Card key={index} className="p-3">
                      <div className="text-xs text-muted-foreground mb-2 capitalize">{block.type}</div>
                      {block.type === 'text' ? (
                        <div>
                          <Textarea
                            value={block.content || ''}
                            onChange={(e) => handleBlockChange(index, e.target.value)}
                            className="min-h-[100px]"
                          />
                          {getFieldError(`text_${index}`) && (
                            <p className="text-xs text-destructive mt-1">{getFieldError(`text_${index}`)}</p>
                          )}
                        </div>
                      ) : block.type === 'heading' ? (
                        <div>
                          <Input
                            value={block.content || ''}
                            onChange={(e) => handleBlockChange(index, e.target.value)}
                            placeholder="Enter heading text"
                          />
                          {getFieldError(`heading_${index}`) && (
                            <p className="text-xs text-destructive mt-1">{getFieldError(`heading_${index}`)}</p>
                          )}
                          <Select
                            value={block.level || 'h2'}
                            onValueChange={(value) => {
                              const newBlocks = [...generatedDraft.blocks];
                              newBlocks[index] = { ...block, level: value };
                              setGeneratedDraft({ ...generatedDraft, blocks: newBlocks });
                              setHasUnsavedChanges(true);
                            }}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="h2">Heading 2</SelectItem>
                              <SelectItem value="h3">Heading 3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : block.type === 'image' ? (
                        <div className="border-2 border-dashed border-primary/30 p-4 rounded-lg text-center bg-primary/5">
                          <p className="text-sm text-muted-foreground mb-3">
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
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {block.content || block.description || 'No content'}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label className="text-sm font-medium">Tags</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {generatedDraft.tags.map((tag, index) => (
                    <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
                {getFieldError('tags') && (
                  <p className="text-xs text-destructive mt-1">{getFieldError('tags')}</p>
                )}
              </div>

              {/* Validation Errors Summary */}
              {validationErrors.length > 0 && (
                <div className="p-3 border border-destructive/20 rounded-md bg-destructive/5">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Validation Errors
                  </div>
                  {validationErrors.map((error, index) => (
                    <div key={index} className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium">{error.field}:</span> {error.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <Button onClick={handleSaveDraft} disabled={loading}>
                  {loading ? "Saving..." : "Save Draft"}
                </Button>
                
{gurus.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Assign Reviewers</Label>
                    
                    {/* Searchable Guru Dropdown */}
                    <Popover open={guruDropdownOpen} onOpenChange={setGuruDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="justify-between">
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Select Reviewers
                          </div>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0">
                        <Command>
                          <CommandInput placeholder="Search gurus..." />
                          <CommandList>
                            <CommandEmpty>No gurus found.</CommandEmpty>
                            <CommandGroup>
                              {gurus.map((guru) => (
                                <CommandItem
                                  key={guru.user_id}
                                  onSelect={() => {
                                    if (selectedGurus.includes(guru.user_id)) {
                                      setSelectedGurus(selectedGurus.filter(id => id !== guru.user_id));
                                    } else {
                                      setSelectedGurus([...selectedGurus, guru.user_id]);
                                    }
                                  }}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={guru.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                      {guru.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="flex-1">{guru.full_name}</span>
                                  {selectedGurus.includes(guru.user_id) && (
                                    <div className="h-4 w-4 rounded bg-primary text-primary-foreground flex items-center justify-center">
                                      ✓
                                    </div>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Gurus Tags */}
                    {selectedGurus.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedGurus.map((guruId) => {
                          const guru = gurus.find(g => g.user_id === guruId);
                          if (!guru) return null;
                          
                          return (
                            <Badge key={guruId} variant="secondary" className="flex items-center gap-2">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={guru.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {guru.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{guru.full_name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() => setSelectedGurus(selectedGurus.filter(id => id !== guruId))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    <Button 
                      onClick={handleAssignGurus} 
                      disabled={loading || selectedGurus.length === 0}
                      variant="secondary"
                      className="w-fit"
                    >
                      Assign to {selectedGurus.length} Reviewer{selectedGurus.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
                
                <Button onClick={handleDiscard} variant="outline">
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}