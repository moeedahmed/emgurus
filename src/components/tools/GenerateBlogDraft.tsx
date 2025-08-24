import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { callFunction } from "@/lib/functionsUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Upload, Link2, Search, Image, Video, Music } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFieldErrors, showErrorToast, FieldError } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";

interface BlogDraft {
  title: string;
  content: string;
  category_id?: string;
  tags: string[];
  cover_image_url?: string;
  excerpt?: string;
}

interface FileUpload {
  file: File;
  content?: string;
  error?: string;
}

const GenerateBlogDraft: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Form state
  const [draft, setDraft] = useState<BlogDraft>({
    title: "",
    content: "",
    tags: [],
  });
  
  // Generation parameters
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [searchOnline, setSearchOnline] = useState(false);
  const [urls, setUrls] = useState<string[]>([""]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedGuru, setSelectedGuru] = useState<string>("");
  const [gurus, setGurus] = useState<any[]>([]);
  
  // Multimedia attachments
  const [attachments, setAttachments] = useState<any[]>([]);

  // Load gurus on mount
  useEffect(() => {
    const loadGurus = async () => {
      try {
        const response = await callFunction("/guru-applications", { action: "list_approved" }, true);
        setGurus(response.gurus || []);
      } catch (error) {
        console.error("Failed to load gurus:", error);
      }
    };
    loadGurus();
  }, []);

  // Unsaved changes tracking
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const validateForm = useCallback((): FieldError[] => {
    const errors: FieldError[] = [];
    
    if (!draft.title.trim()) {
      errors.push({ field: "title", message: "Title is required" });
    } else if (draft.title.trim().length < 3) {
      errors.push({ field: "title", message: "Title must be at least 3 characters" });
    }
    
    if (!draft.content.trim()) {
      errors.push({ field: "content", message: "Content is required" });
    } else if (draft.content.trim().length < 10) {
      errors.push({ field: "content", message: "Content must be at least 10 characters" });
    }
    
    if (draft.tags.length === 0) {
      errors.push({ field: "tags", message: "At least one tag is required" });
    }
    
    return errors;
  }, [draft]);

  const updateFieldErrors = useCallback((errors: FieldError[]) => {
    const errorMap: Record<string, string> = {};
    errors.forEach(error => {
      errorMap[error.field] = error.message;
    });
    setFieldErrors(errorMap);
  }, []);

  const handleInputChange = useCallback((field: keyof BlogDraft, value: any) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: "" }));
    }
  }, [fieldErrors]);

  const handleGenerate = async () => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const proceed = window.confirm("You have unsaved changes. Generating new content will replace your current draft. Continue?");
      if (!proceed) return;
    }

    setGenerating(true);
    setFieldErrors({});
    
    try {
      const payload = {
        topic: topic.trim(),
        tone,
        length,
        searchOnline,
        urls: urls.filter(url => url.trim()),
        files: files.map(f => ({ name: f.file.name, content: f.content })),
      };

      const response = await callFunction("/blogs-api", payload, true);
      
      if (response.success) {
        setDraft({
          title: response.draft.title || "",
          content: response.draft.content || "",
          category_id: response.draft.category_id,
          tags: response.draft.tags || [],
          cover_image_url: response.draft.cover_image_url,
          excerpt: response.draft.excerpt,
        });
        setHasUnsavedChanges(true);
        toast({ description: "Blog draft generated successfully" });
      } else {
        const errors = getFieldErrors(response);
        updateFieldErrors(errors);
        showErrorToast(response, "Failed to generate blog draft");
      }
    } catch (error) {
      const errors = getFieldErrors(error);
      updateFieldErrors(errors);
      showErrorToast(error, "Failed to generate blog draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setFieldErrors({});
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      updateFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const response = await callFunction("/blogs-api", {
        action: "create_draft",
        ...draft,
      }, true);

      if (response.success) {
        setHasUnsavedChanges(false);
        toast({ description: `Draft saved successfully (ID: ${response.post.id})` });
        navigate("/blogs/dashboard");
      } else {
        const errors = getFieldErrors(response);
        updateFieldErrors(errors);
        showErrorToast(response, "Failed to save draft");
      }
    } catch (error) {
      const errors = getFieldErrors(error);
      updateFieldErrors(errors);
      showErrorToast(error, "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignReviewer = async () => {
    if (!selectedGuru) {
      toast({ description: "Please select a reviewer", variant: "destructive" });
      return;
    }

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      updateFieldErrors(validationErrors);
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      // First save the draft
      const saveResponse = await callFunction("/blogs-api", {
        action: "create_draft",
        ...draft,
      }, true);

      if (!saveResponse.success) {
        const errors = getFieldErrors(saveResponse);
        updateFieldErrors(errors);
        showErrorToast(saveResponse, "Failed to save draft");
        return;
      }

      // Then assign reviewer
      const assignResponse = await callFunction("/blogs-api", {
        action: "assign_reviewer",
        post_id: saveResponse.post.id,
        reviewer_id: selectedGuru,
      }, true);

      if (assignResponse.success) {
        setHasUnsavedChanges(false);
        toast({ description: "Draft saved and assigned for review" });
        navigate("/blogs/dashboard");
      } else {
        const errors = getFieldErrors(assignResponse);
        updateFieldErrors(errors);
        showErrorToast(assignResponse, "Failed to assign reviewer");
      }
    } catch (error) {
      const errors = getFieldErrors(error);
      updateFieldErrors(errors);
      showErrorToast(error, "Failed to assign reviewer");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [
      ...prev,
      ...newFiles.map(file => ({ file }))
    ]);
  };

  const addUrl = () => {
    setUrls(prev => [...prev, ""]);
  };

  const updateUrl = (index: number, value: string) => {
    setUrls(prev => prev.map((url, i) => i === index ? value : url));
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !draft.tags.includes(tag.trim())) {
      handleInputChange("tags", [...draft.tags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange("tags", draft.tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Generate Blog Draft</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Parameters */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generation Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="What should this blog be about?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="length">Length</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (300-500 words)</SelectItem>
                    <SelectItem value="medium">Medium (500-1000 words)</SelectItem>
                    <SelectItem value="long">Long (1000+ words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="searchOnline"
                  checked={searchOnline}
                  onChange={(e) => setSearchOnline(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="searchOnline">Search online for additional context</Label>
              </div>

              <Tabs defaultValue="files" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="files">Upload Files</TabsTrigger>
                  <TabsTrigger value="urls">Reference URLs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="files" className="space-y-2">
                  <div>
                    <Label htmlFor="files">Upload reference files (PDF, DOCX, TXT)</Label>
                    <input
                      type="file"
                      id="files"
                      multiple
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{file.file.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setFiles(prev => prev.filter((_, index) => index !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="urls" className="space-y-2">
                  {urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="https://example.com/article"
                        value={url}
                        onChange={(e) => updateUrl(i, e.target.value)}
                      />
                      <Button size="sm" variant="outline" onClick={() => removeUrl(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addUrl}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Add URL
                  </Button>
                </TabsContent>
              </Tabs>

              <Button 
                onClick={handleGenerate} 
                disabled={generating || !topic.trim()}
                className="w-full"
              >
                {generating ? "Generating..." : "Generate Draft"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview & Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Blog Preview & Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
                </TabsList>
                
                <TabsContent value="editor" className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={draft.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      className={fieldErrors.title ? "border-destructive" : ""}
                    />
                    {fieldErrors.title && (
                      <p className="text-sm text-destructive mt-1">{fieldErrors.title}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={draft.content}
                      onChange={(e) => handleInputChange("content", e.target.value)}
                      rows={15}
                      className={fieldErrors.content ? "border-destructive" : ""}
                    />
                    {fieldErrors.content && (
                      <p className="text-sm text-destructive mt-1">{fieldErrors.content}</p>
                    )}
                  </div>

                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {draft.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary">
                          {tag}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-auto p-0 ml-2"
                            onClick={() => removeTag(tag)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add a tag and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                      className={fieldErrors.tags ? "border-destructive" : ""}
                    />
                    {fieldErrors.tags && (
                      <p className="text-sm text-destructive mt-1">{fieldErrors.tags}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="excerpt">Excerpt (Optional)</Label>
                    <Textarea
                      id="excerpt"
                      value={draft.excerpt || ""}
                      onChange={(e) => handleInputChange("excerpt", e.target.value)}
                      rows={3}
                      placeholder="Brief description of the blog post"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="multimedia" className="space-y-4">
                  <div className="text-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <div className="flex justify-center space-x-4 mb-4">
                      <Image className="h-8 w-8 text-muted-foreground" />
                      <Video className="h-8 w-8 text-muted-foreground" />
                      <Music className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Drop multimedia files here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-2">Support for images, videos, and audio</p>
                  </div>
                  
                  {attachments.map((attachment, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded">
                      <span className="text-sm">{attachment.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setAttachments(prev => prev.filter((_, index) => index !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 mt-4">
                <Button 
                  onClick={handleSave}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? "Saving..." : "Save Draft"}
                </Button>

                {gurus.length > 0 && (
                  <div className="flex gap-2 flex-1">
                    <Select value={selectedGuru} onValueChange={setSelectedGuru}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Reviewer" />
                      </SelectTrigger>
                      <SelectContent>
                        {gurus.map((guru) => (
                          <SelectItem key={guru.user_id} value={guru.user_id}>
                            {guru.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleAssignReviewer}
                      disabled={loading || !selectedGuru}
                    >
                      {loading ? "Assigning..." : "Assign & Submit"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GenerateBlogDraft;