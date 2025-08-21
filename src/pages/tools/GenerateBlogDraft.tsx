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

interface GeneratedDraft {
  title: string;
  content: string;
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
    assigned_guru: '',
    additional_instructions: ''
  });
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
          instructions: formData.additional_instructions,
          messages: [
            {
              role: 'system',
              content: 'You are an expert medical writer specializing in Emergency Medicine content. Generate high-quality, evidence-based blog posts for EM clinicians.'
            },
            {
              role: 'user',
              content: `Generate a comprehensive blog post about "${formData.topic}". ${formData.keywords ? `Focus on these key areas: ${formData.keywords}.` : ''} ${formData.additional_instructions || ''}\n\nFormat the response as JSON with the following structure:\n{\n  "title": "Blog post title",\n  "content": "Full blog post content in markdown format",\n  "tags": ["tag1", "tag2", "tag3"]\n}\n\nThe content should be professionally written, evidence-based, and practical for emergency medicine practitioners.`
            }
          ]
        }
      });

      if (response.error) throw new Error(response.error.message || 'Generation failed');

      let result;
      try {
        // Try to parse JSON response
        result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (result.message) {
          result = JSON.parse(result.message);
        }
      } catch {
        // Fallback: treat as text and structure it
        const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        result = {
          title: formData.topic,
          content: content,
          tags: formData.keywords ? formData.keywords.split(',').map(k => k.trim()) : []
        };
      }

      setGeneratedDraft({
        title: result.title || formData.topic,
        content: result.content || '',
        tags: result.tags || []
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
    
    if (!formData.assigned_guru) {
      toast({
        title: "Missing Assignment",
        description: "Please select a guru to assign this draft to.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create the draft
      const { id } = await createDraft({
        title: generatedDraft.title,
        content_md: generatedDraft.content,
        category_id: formData.category_id || undefined,
        tag_slugs: generatedDraft.tags
      });

      // Assign to guru by updating the post
      const { error: assignError } = await supabase
        .from('blog_posts')
        .update({ 
          author_id: formData.assigned_guru,
          reviewer_id: user.id // Admin who generated it becomes reviewer
        })
        .eq('id', id);

      if (assignError) throw assignError;

      toast({
        title: "Draft Saved & Assigned",
        description: "Blog draft has been created and assigned to the selected guru.",
      });

      // Reset form and generated content
      setFormData({
        topic: '',
        keywords: '',
        category_id: '',
        assigned_guru: '',
        additional_instructions: ''
      });
      setGeneratedDraft(null);
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save blog draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
              <Label htmlFor="assigned_guru">Assign to Guru *</Label>
              <Select 
                value={formData.assigned_guru} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_guru: value }))}
              >
                <SelectTrigger>
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
                  <Label className="text-sm font-medium">Content Preview</Label>
                  <div className="p-3 bg-muted rounded-md max-h-40 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">
                      {generatedDraft.content.slice(0, 500)}
                      {generatedDraft.content.length > 500 && "..."}
                    </p>
                  </div>
                </div>

                {generatedDraft.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {generatedDraft.tags.map((tag, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSaveDraft} 
                  disabled={loading || !formData.assigned_guru}
                  className="w-full"
                >
                  {loading ? "Saving..." : "Save Draft & Assign to Guru"}
                </Button>
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