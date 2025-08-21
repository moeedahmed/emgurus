import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createDraft } from "@/lib/blogsApi";

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

export default function GenerateBlogDraft() {
  const { user, loading: userLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraft | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    keywords: '',
    category_id: '',
    additional_instructions: ''
  });
  const [assignedGuru, setAssignedGuru] = useState('');
  const { toast } = useToast();

  // Load gurus and categories
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

        // Load categories
        const { data: categoriesData } = await supabase
          .from('blog_categories')
          .select('id, title, slug')
          .order('title');
        
        setCategories(categoriesData || []);
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
          description: "Unexpected response format. Please try again.",
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

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for blog generation.",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke('ai-route', {
        body: {
          purpose: 'blog_generation',
          topic: formData.topic,
          keywords: formData.keywords,
          instructions: formData.additional_instructions
        }
      });

      if (response.error) throw new Error(response.error.message || 'Generation failed');

      // Backend now returns clean structured data - no parsing needed
      const result = response.data;
      
      // Validate that backend returned expected structure
      if (!result || typeof result !== 'object' || !result.title) {
        throw new Error('Invalid response format from backend');
      }

      // Enrich AI-generated tags with medical context
      const enrichedTags = Array.isArray(result.tags) && result.tags.length > 0 
        ? enrichTags(result.tags) 
        : [];

      setGeneratedDraft({
        title: result.title,
        blocks: result.blocks,
        tags: enrichedTags
      });

      toast({
        title: "Draft Generated",
        description: "AI blog draft has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating blog:', error);
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
      const { id } = await createDraft({
        title: generatedDraft.title,
        content_md: content_md,
        category_id: formData.category_id || undefined,
        tag_slugs: generatedDraft.tags
      });

      toast({
        title: "Draft Saved",
        description: "Blog draft has been saved successfully.",
      });

      // Reset form and generated content
      setFormData({
        topic: '',
        keywords: '',
        category_id: '',
        additional_instructions: ''
      });
      setGeneratedDraft(null);
      setAssignedGuru('');
      
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
            author_id: assignedGuru,
            reviewer_id: user.id // Admin who generated it becomes reviewer
          })
          .eq('id', draftId);

        if (assignError) throw assignError;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">AI Blog Generator</h1>
        <p className="text-muted-foreground">Generate AI-powered blog drafts and assign them to Gurus for review.</p>
      </div>

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
              <Label htmlFor="keywords">Keywords/Focus Areas</Label>
              <Input
                id="keywords"
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="e.g., STEMI, cardiac catheterization, door-to-balloon"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div>
              <Label htmlFor="instructions">Additional Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.additional_instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, additional_instructions: e.target.value }))}
                placeholder="Any specific requirements, tone, or focus areas..."
                rows={3}
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={generating || !formData.topic.trim()} 
              className="w-full"
            >
              {generating ? "Generating..." : "Generate Blog Draft"}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Content Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Draft</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedDraft ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-medium">{generatedDraft.title}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Content Blocks</Label>
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

                <div>
                  <Label className="text-sm font-medium">Suggested Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {generatedDraft.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        {tag}
                      </span>
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