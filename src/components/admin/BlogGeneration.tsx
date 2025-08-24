import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Validation helper
const validateBlogPost = (post: any): string[] => {
  const errors: string[] = [];
  
  if (!post.title?.trim()) {
    errors.push("Blog title cannot be empty");
  }
  
  if (!post.content?.trim()) {
    errors.push("Blog content cannot be empty");
  }
  
  if (!post.category) {
    errors.push("Category must be selected");
  }
  
  if (!post.tags || post.tags.length === 0) {
    errors.push("At least one tag is required");
  }
  
  return errors;
};

interface BlogPost {
  title: string;
  content: string;
  category: string;
  tags: string[];
  description?: string;
}

export default function BlogGeneration() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("informative");
  const [length, setLength] = useState("medium");
  
  const [currentPost, setCurrentPost] = useState<BlogPost | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [postCounter, setPostCounter] = useState(0);
  
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [gurus, setGurus] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [selectedGuru, setSelectedGuru] = useState("");

  useEffect(() => {
    loadCategories();
    loadGurus();
  }, []);

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('blog_categories')
        .select('id, name')
        .order('name');
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadGurus = async () => {
    try {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'guru');

      if (!userRoles?.length) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userRoles.map(ur => ur.user_id));

      setGurus(profiles || []);
    } catch (error) {
      console.error('Failed to load gurus:', error);
    }
  };

  const getGuruName = (guruId: string) => {
    return gurus.find(g => g.user_id === guruId)?.full_name || 'Unknown';
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('blogs-api', {
        body: {
          action: "generate",
          topic: topic.trim(),
          style,
          length,
          count: 1
        }
      });

      if (error) throw error;

      if (data?.items?.[0]) {
        const generated = data.items[0];
        setCurrentPost({
          title: generated.title || "",
          content: generated.content || "",
          category: categories[0]?.id || "",
          tags: generated.tags || [],
          description: generated.description || ""
        });
        setHasUnsavedChanges(false);
        toast.success("Blog post generated successfully");
      } else {
        throw new Error("No content generated");
      }
    } catch (error: any) {
      console.error("Failed to generate blog post:", error);
      toast.error(error.message || "Failed to generate blog post");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePost = async () => {
    if (!currentPost) {
      toast.error("No post to save");
      return;
    }

    const validationErrors = validateBlogPost(currentPost);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_blog_draft', {
        p_title: currentPost.title,
        p_content_md: currentPost.content,
        p_category_id: currentPost.category,
        p_tags: currentPost.tags
      });

      if (error) throw error;
      
      toast.success(`Draft saved (ID: ${data.id})`);
      
      resetState();
      setPostCounter(prev => prev + 1);
    } catch (error: any) {
      console.error("Failed to save post:", error);
      toast.error(error.message || "Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignGuru = async () => {
    if (!currentPost || !selectedGuru) {
      toast.error("No post to assign or guru selected");
      return;
    }

    const validationErrors = validateBlogPost(currentPost);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }

    setIsAssigning(true);
    try {
      // First create draft
      const { data: draft, error: draftError } = await supabase.rpc('create_blog_draft', {
        p_title: currentPost.title,
        p_content_md: currentPost.content,
        p_category_id: currentPost.category,
        p_tags: currentPost.tags
      });

      if (draftError) throw draftError;

      // Submit for review
      const { error: submitError } = await supabase.rpc('submit_blog_for_review', {
        p_post_id: draft.id
      });

      if (submitError) throw submitError;

      // Assign reviewer
      const { error: assignError } = await supabase.rpc('assign_reviewer', {
        p_post_id: draft.id,
        p_reviewer_id: selectedGuru,
        p_note: `Auto-assigned via blog generator on ${new Date().toISOString()}`
      });

      if (assignError) throw assignError;

      toast.success(`Post assigned to ${getGuruName(selectedGuru)}`);
      
      resetState();
      setPostCounter(prev => prev + 1);
    } catch (error: any) {
      console.error("Failed to assign post:", error);
      toast.error(error.message || "Failed to assign post");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDiscard = () => {
    resetState();
    setPostCounter(prev => prev + 1);
    toast.success("Post discarded");
  };

  const handleNextPost = () => {
    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        "You have unsaved changes to the current post. Are you sure you want to generate a new post? Your changes will be lost."
      );
      if (!proceed) return;
    }
    
    resetState();
    handleGenerate();
  };

  const resetState = () => {
    setCurrentPost(null);
    setHasUnsavedChanges(false);
    setSelectedGuru("");
  };

  const updateCurrentPost = (field: keyof BlogPost, value: any) => {
    if (!currentPost) return;
    
    setCurrentPost(prev => prev ? { ...prev, [field]: value } : null);
    setHasUnsavedChanges(true);
  };

  // Add beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Panel - Generation Controls */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Blog Generator
            <Badge variant="secondary">{postCounter} posts generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="topic">Topic *</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter blog topic..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="narrative">Narrative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Length</Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (500-800 words)</SelectItem>
                  <SelectItem value="medium">Medium (800-1200 words)</SelectItem>
                  <SelectItem value="long">Long (1200-2000 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button 
              onClick={handleGenerate} 
              disabled={!topic.trim() || isGenerating}
              className="flex-1"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
            
            {currentPost && (
              <Button 
                onClick={handleNextPost} 
                variant="outline"
                disabled={isGenerating}
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Generated Post Editor */}
      {currentPost && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Post Editor
              {hasUnsavedChanges && <Badge variant="destructive">Unsaved Changes</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="post-title">Title *</Label>
              <Input
                id="post-title"
                value={currentPost.title}
                onChange={(e) => updateCurrentPost('title', e.target.value)}
                placeholder="Enter post title..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="post-content">Content *</Label>
              <Textarea
                id="post-content"
                value={currentPost.content}
                onChange={(e) => updateCurrentPost('content', e.target.value)}
                placeholder="Post content..."
                className="mt-1 min-h-[200px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select 
                  value={currentPost.category} 
                  onValueChange={(value) => updateCurrentPost('category', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assign to Guru</Label>
                <Select value={selectedGuru} onValueChange={setSelectedGuru}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select guru" />
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
            </div>

            <div>
              <Label>Tags *</Label>
              <Input
                value={currentPost.tags.join(', ')}
                onChange={(e) => updateCurrentPost('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="Enter tags separated by commas..."
                className="mt-1"
              />
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                onClick={handleSavePost}
                disabled={isSaving}
                variant="outline"
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
              
              <Button
                onClick={handleAssignGuru}
                disabled={isAssigning || !selectedGuru}
                className="flex-1"
              >
                {isAssigning ? "Assigning..." : "Assign Guru"}
              </Button>
              
              <Button
                onClick={handleDiscard}
                variant="destructive"
                className="flex-1"
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}