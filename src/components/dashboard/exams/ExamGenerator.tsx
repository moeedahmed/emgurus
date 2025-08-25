import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import { supabase } from "@/integrations/supabase/client";
import { Save, Users, Trash2, ArrowRight, AlertCircle, Upload, Plus, X, FileText, ExternalLink, Search, Clock, CheckCircle, History } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

interface GeneratedQuestion {
  id: string;
  stem: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  exam_type?: string;
  topic?: string;
  difficulty?: string;
  tags?: string[];
  reference?: string;
}

interface EditableQuestion extends GeneratedQuestion {
  isEditing: boolean;
}

interface ValidationErrors {
  stem?: string;
  options?: string;
  correct_answer?: string;
  explanation?: string;
  tags?: string;
}

interface GenerationLog {
  ts: string;
  topic: string;
  instructions: string;
  urlCount: number;
  fileCount: number;
  success: boolean;
  error?: string;
  question?: EditableQuestion;
  sources?: {urls: string[], files: Array<{name: string; content: string; size: number}>};
}

export default function ExamGenerator() {
  const { user, loading: userLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<EditableQuestion | null>(null);
  const [generationCount, setGenerationCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const originalQuestionRef = useRef<EditableQuestion | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    topicId: '',
    difficulty: 'medium',
    examType: 'mrcem_sba',
    instructions: ''
  });
  
  // Sources state (parity with Blog Generator)
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [sourceFiles, setSourceFiles] = useState<Array<{name: string; content: string; size: number}>>([]);
  const [searchOnline, setSearchOnline] = useState(false);
  const [currentTab, setCurrentTab] = useState<'generate' | 'history'>('generate');
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  
  const [topics, setTopics] = useState<Array<{ id: string; title: string; exam_type: string }>>([]);
  const [gurus, setGurus] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [selectedGuru, setSelectedGuru] = useState("");
  const { toast } = useToast();

  // Load gurus and topics on component mount
  useEffect(() => {
    loadGurus();
    loadTopics();
  }, []);

  // Load topics when exam type changes
  useEffect(() => {
    loadTopics();
  }, [formData.examType]);

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

  const loadTopics = async () => {
    try {
      // Map form exam type to enum
      const examTypeEnum = mapExamTypeToEnum(formData.examType);
      
      const { data } = await supabase
        .from('curriculum_map')
        .select('id, slo_title, exam_type')
        .eq('exam_type', examTypeEnum)
        .order('slo_title');
      
      setTopics((data || []).map(item => ({
        id: item.id,
        title: item.slo_title,
        exam_type: item.exam_type
      })));
    } catch (error) {
      console.error('Failed to load topics:', error);
      setTopics([]);
    }
  };

  // Source management functions (parity with Blog Generator)
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

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
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setSourceFiles(prev => [...prev, {
          name: file.name,
          content: content,
          size: file.size
        }]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index: number) => {
    setSourceFiles(sourceFiles.filter((_, i) => i !== index));
  };

  // History management
  const saveGenerationLog = (logEntry: GenerationLog) => {
    try {
      const existing = JSON.parse(localStorage.getItem('examGen:history') || '[]');
      const updated = [logEntry, ...existing].slice(0, 10); // Keep last 10
      localStorage.setItem('examGen:history', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save generation log:', error);
    }
  };

  const getGenerationHistory = (): GenerationLog[] => {
    try {
      return JSON.parse(localStorage.getItem('examGen:history') || '[]');
    } catch {
      return [];
    }
  };

  const loadFromHistory = (logEntry: GenerationLog) => {
    if (logEntry.question) {
      setCurrentQuestion(logEntry.question);
      originalQuestionRef.current = { ...logEntry.question };
      setHasUnsavedChanges(true);
    }
    if (logEntry.sources) {
      setSourceUrls(logEntry.sources.urls);
      setSourceFiles(logEntry.sources.files);
    }
    setFormData(prev => ({
      ...prev,
      instructions: logEntry.instructions
    }));
    setCurrentTab('generate');
  };

  // Helper function to add sources to explanation
  const addSourcestoExplanation = (explanation: string, urls: string[], files: Array<{name: string; content: string; size: number}>): string => {
    if (urls.length === 0 && files.length === 0) return explanation;
    
    const sourceParts = [explanation];
    
    if (urls.length > 0 || files.length > 0) {
      sourceParts.push('\n\n**Sources:**');
      
      if (urls.length > 0) {
        urls.forEach((url, index) => {
          try {
            const urlObj = new URL(url);
            const displayText = `${urlObj.hostname}${urlObj.pathname.slice(0, 30)}${urlObj.pathname.length > 30 ? '...' : ''}`;
            sourceParts.push(`${index + 1}. ${displayText}`);
          } catch {
            sourceParts.push(`${index + 1}. ${url}`);
          }
        });
      }
      
      if (files.length > 0) {
        const urlCount = urls.length;
        files.forEach((file, index) => {
          sourceParts.push(`${urlCount + index + 1}. ${file.name}`);
        });
      }
    }
    
    return sourceParts.join('\n');
  };

  const mapExamTypeToEnum = (type: string) => {
    switch (type) {
      case 'mrcem_sba': return 'MRCEM_SBA';
      case 'frcem_sba': return 'FRCEM_SBA';
      case 'mrcem_primary': return 'MRCEM_PRIMARY';
      case 'fcps_part1': return 'FCPS_PART1';
      case 'fcps_imm': return 'FCPS_IMM';
      default: return 'OTHER';
    }
  };

  const getGuruName = (guruId: string) => {
    return gurus.find(g => g.user_id === guruId)?.full_name || 'Unknown';
  };

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading generator…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to use the exam generator.</div>;
  }

  const validateQuestion = (question: EditableQuestion): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!question.stem?.trim()) {
      errors.stem = "Question stem is required";
    } else if (question.stem.trim().length < 10) {
      errors.stem = "Question stem must be at least 10 characters";
    }
    
    if (!question.options || question.options.length < 2) {
      errors.options = "At least 2 answer options are required";
    } else if (question.options.some(opt => !opt?.trim())) {
      errors.options = "All answer options must be non-empty";
    }
    
    if (!question.correct_answer?.trim()) {
      errors.correct_answer = "A correct answer must be selected";
    } else if (!question.options.includes(question.correct_answer)) {
      errors.correct_answer = "Correct answer must match one of the options";
    }
    
    if (!question.explanation?.trim()) {
      errors.explanation = "Explanation is required";
    } else if (question.explanation.trim().length < 10) {
      errors.explanation = "Explanation must be at least 10 characters";
    }
    
    if (!question.tags || question.tags.length === 0 || !question.tags.some(tag => tag.trim())) {
      errors.tags = "At least one tag is required";
    }
    
    return errors;
  };

  const checkForUnsavedChanges = (): boolean => {
    if (!currentQuestion || !originalQuestionRef.current) return false;
    
    const original = originalQuestionRef.current;
    const current = currentQuestion;
    
    return (
      original.stem !== current.stem ||
      JSON.stringify(original.options) !== JSON.stringify(current.options) ||
      original.correct_answer !== current.correct_answer ||
      original.explanation !== current.explanation ||
      JSON.stringify(original.tags) !== JSON.stringify(current.tags) ||
      original.reference !== current.reference
    );
  };

  const handleGenerate = async () => {
    // Check for unsaved changes
    if (currentQuestion && checkForUnsavedChanges()) {
      const confirmGenerate = window.confirm(
        "You have unsaved changes to the current question. Are you sure you want to generate a new question? Your changes will be lost."
      );
      if (!confirmGenerate) return;
    }

    if (!formData.topicId) {
      toast({
        title: "Missing Topic",
        description: "Please select a topic for question generation.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setValidationErrors({});
    try {
    // Schema validation before sending payload
    if (!Array.isArray(sourceFiles)) {
      toast({
        title: "Invalid Source Files",
        description: "Source files must be provided as an array.",
        variant: "destructive"
      });
      return;
    }

    if (!Array.isArray(sourceUrls)) {
      toast({
        title: "Invalid Source URLs",
        description: "Source URLs must be provided as an array.",
        variant: "destructive"
      });
      return;
    }

    // Validate URLs
    for (const url of sourceUrls) {
      if (!isValidUrl(url)) {
        toast({
          title: "Invalid URL",
          description: `Please provide a valid URL: ${url}`,
          variant: "destructive"
        });
        return;
      }
    }

    if (typeof searchOnline !== 'boolean') {
      toast({
        title: "Invalid Browse Setting",
        description: "Browse online setting must be true or false.",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      action: "bulk_generate",
      exam_type: formData.examType,
      topic_id: formData.topicId,
      difficulty: formData.difficulty,
      count: 1,
      persistAsDraft: false, // Don't auto-save, let user decide
      instructions: formData.instructions || undefined,
      // Add sources to payload (parity with Blog Generator)
      source_files: sourceFiles,
      source_links: sourceUrls,
      browsing: searchOnline
    };

      const result = await supabase.functions.invoke('ai-exams-api', { body: payload });
      
      // Explicitly check for success before accessing items
      if (!result.data?.success) {
        throw new Error(result.data?.error || 'AI generation failed, please try again');
      }
      
      if (!result.data?.items || !Array.isArray(result.data.items) || result.data.items.length === 0) {
        throw new Error('No questions were generated, please try again');
      }
        const question = result.data.items[0];
        const optionsArray = question.options && typeof question.options === 'object' && !Array.isArray(question.options)
          ? Object.values(question.options)
          : question.options || [];
        
        const newQuestion: EditableQuestion = {
          id: `generated-${Date.now()}`,
          stem: question.question || question.stem || '',
          options: optionsArray,
          correct_answer: question.correct || question.correct_answer || question.answer || '',
          explanation: addSourcestoExplanation(question.explanation || '', sourceUrls, sourceFiles),
          exam_type: formData.examType,
          topic: question.topic || topics.find(t => t.id === formData.topicId)?.title || '',
          difficulty: formData.difficulty,
          tags: question.subtopic ? [question.subtopic] : [],
          reference: question.reference || question.source || '',
          isEditing: true
        };
        
        setCurrentQuestion(newQuestion);
        originalQuestionRef.current = { ...newQuestion };
        setHasUnsavedChanges(false);
        setGenerationCount(prev => prev + 1);
        
        // Log successful generation
        const logEntry: GenerationLog = {
          ts: new Date().toISOString(),
          topic: topics.find(t => t.id === formData.topicId)?.title || 'Unknown Topic',
          instructions: formData.instructions,
          urlCount: sourceUrls.length,
          fileCount: sourceFiles.length,
          success: true,
          question: newQuestion,
          sources: { urls: sourceUrls, files: sourceFiles }
        };
        saveGenerationLog(logEntry);
        
        toast({
          title: "Question Generated",
          description: `New question created for ${topics.find(t => t.id === formData.topicId)?.title || 'selected topic'}`,
        });
    } catch (error: any) {
      console.error('Error generating questions:', error);
      
      // Log failed generation
      const logEntry: GenerationLog = {
        ts: new Date().toISOString(),
        topic: topics.find(t => t.id === formData.topicId)?.title || 'Unknown Topic',
        instructions: formData.instructions,
        urlCount: sourceUrls.length,
        fileCount: sourceFiles.length,
        success: false,
        error: error?.message || "Generation failed"
      };
      saveGenerationLog(logEntry);
      
      // Handle structured errors
      if (error?.data?.errors && Array.isArray(error.data.errors)) {
        const fieldErrors: ValidationErrors = {};
        error.data.errors.forEach((err: {field: string, message: string}) => {
          fieldErrors[err.field as keyof ValidationErrors] = err.message;
        });
        setValidationErrors(fieldErrors);
      }
      
      toast({
        title: "Generation Failed",
        description: error?.message || "Unable to generate question. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!currentQuestion) return;
    
    // Validate question
    const errors = validateQuestion(currentQuestion);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast({
        title: "Validation Failed",
        description: "Please fix the errors below before saving.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      // Use the create_exam_draft RPC function for proper draft creation
      const { data, error } = await supabase
        .from("review_exam_questions")
        .insert({
          question: currentQuestion.stem,
          options: currentQuestion.options,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation || '',
          exam_type: mapExamTypeToEnum(currentQuestion.exam_type || formData.examType),
          created_by: user.id,
          status: 'draft',
          submitted_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) throw error;
      
      console.log('Draft saved successfully:', data);
      
      toast({
        title: "Question Saved",
        description: `Question saved to drafts (ID: ${data.id.slice(0, 8)}...)`,
      });
      
      // Reset state
      setCurrentQuestion(null);
      originalQuestionRef.current = null;
      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (error: any) {
      console.error('Error saving question:', error);
      let errorMessage = "Unable to save question. Please try again.";
      
      // Parse specific error messages
      if (error?.message?.includes('foreign key')) {
        errorMessage = "Invalid exam type selected.";
      } else if (error?.message?.includes('NOT NULL')) {
        errorMessage = "Required fields are missing.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGuru = async () => {
    if (!currentQuestion || !selectedGuru) {
      toast({
        title: "Missing Information",
        description: "Please select a guru and ensure a question is generated.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate question first
    const errors = validateQuestion(currentQuestion);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast({
        title: "Validation Failed",
        description: "Please fix the errors below before assigning.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      // Use the AI Exams API for consistent multi-reviewer assignment
      const payload = {
        action: "bulk_generate",
        exam_type: mapExamTypeToEnum(currentQuestion.exam_type || formData.examType),
        topic_id: formData.topicId,
        difficulty: currentQuestion.difficulty || formData.difficulty,
        count: 1,
        persistAsDraft: true,
        reviewer_assign_to: [selectedGuru], // Multi-reviewer support
        preGenerated: {
          question: currentQuestion.stem,
          options: currentQuestion.options,
          correct: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation,
          reference: currentQuestion.reference
        }
      };

      const result = await supabase.functions.invoke('ai-exams-api', { body: payload });
      
      if (result.data?.success !== false && result.data?.items && result.data.items.length > 0) {
        const savedQuestion = result.data.items[0];
        
        toast({
          title: "Question Assigned",
          description: `Question assigned to ${getGuruName(selectedGuru)} (ID: ${savedQuestion.id?.slice(0, 8) || 'generated'}...)`,
        });
        
        // Reset state
        setCurrentQuestion(null);
        originalQuestionRef.current = null;
        setHasUnsavedChanges(false);
        setValidationErrors({});
        setSelectedGuru("");
      } else {
        // Parse structured errors if available
        if (result.data?.errors && Array.isArray(result.data.errors)) {
          const fieldErrors: ValidationErrors = {};
          result.data.errors.forEach((error: {field: string, message: string}) => {
            fieldErrors[error.field as keyof ValidationErrors] = error.message;
          });
          setValidationErrors(fieldErrors);
          
          toast({
            title: "Validation Failed",
            description: "Please fix the errors highlighted below.",
            variant: "destructive"
          });
        } else {
          throw new Error(result.data?.error || 'Failed to assign question');
        }
      }
    } catch (error: any) {
      console.error('Error assigning question:', error);
      let errorMessage = "Unable to assign question. Please try again.";
      
      // Parse specific error messages
      if (error?.message?.includes('foreign key')) {
        errorMessage = "Invalid exam type selected.";
      } else if (error?.message?.includes('NOT NULL')) {
        errorMessage = "Required fields are missing.";
      } else if (error?.message?.includes('Forbidden')) {
        errorMessage = "You don't have permission to assign questions.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Assignment Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setCurrentQuestion(null);
    originalQuestionRef.current = null;
    setHasUnsavedChanges(false);
    setValidationErrors({});
    toast({
      description: "Question discarded.",
    });
  };

  const updateQuestionField = (field: keyof EditableQuestion, value: any) => {
    if (!currentQuestion) return;
    const updated = { ...currentQuestion, [field]: value };
    setCurrentQuestion(updated);
    setHasUnsavedChanges(checkForUnsavedChanges());
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const updateOption = (index: number, value: string) => {
    if (!currentQuestion) return;
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    const updated = { ...currentQuestion, options: newOptions };
    setCurrentQuestion(updated);
    setHasUnsavedChanges(checkForUnsavedChanges());
    
    // Clear validation errors for options
    if (validationErrors.options) {
      setValidationErrors(prev => ({ ...prev, options: undefined }));
    }
  };

  const setCorrectAnswer = (option: string) => {
    if (!currentQuestion) return;
    const updated = { ...currentQuestion, correct_answer: option };
    setCurrentQuestion(updated);
    setHasUnsavedChanges(checkForUnsavedChanges());
    
    // Clear validation error for correct answer
    if (validationErrors.correct_answer) {
      setValidationErrors(prev => ({ ...prev, correct_answer: undefined }));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Exam Generator</h1>
        <p className="text-muted-foreground">Generate AI-powered exam questions and assign them for review.</p>
      </div>

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'generate' | 'history')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Generator Form */}
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-1">AI Question Generator</h2>
                <p className="text-sm text-muted-foreground">Generate one question at a time for review and editing.</p>
                {generationCount > 0 && (
                  <div className="mt-2">
                    <Badge variant="secondary">{generationCount} questions generated so far</Badge>
                  </div>
                )}
              </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="examType">Exam Type</Label>
              <Select 
                value={formData.examType} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, examType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mrcem_sba">MRCEM SBA</SelectItem>
                  <SelectItem value="frcem_sba">FRCEM SBA</SelectItem>
                  <SelectItem value="mrcem_primary">MRCEM Primary</SelectItem>
                  <SelectItem value="fcps_part1">FCPS Part 1</SelectItem>
                  <SelectItem value="fcps_imm">FCPS IMM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="topic">Topic</Label>
              <Select 
                value={formData.topicId} 
                onValueChange={(value) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    topicId: value,
                    topic: topics.find(t => t.id === value)?.title || ''
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a curriculum topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(topic => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select 
                value={formData.difficulty} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="instructions">Additional Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Any specific requirements or focus areas..."
                rows={3}
              />
            </div>

            {/* Sources Section (parity with Blog Generator) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>Sources (Optional)</span>
                  <Search className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg">
                {/* File Upload */}
                <div>
                  <Label className="text-sm font-medium">Upload Reference Files</Label>
                  <div className="mt-1">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, DOCX, TXT files up to 10MB
                    </p>
                  </div>
                  
                  {sourceFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sourceFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)}KB)</span>
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

                {/* URL Input */}
                <div>
                  <Label className="text-sm font-medium">Reference URLs</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newUrl}
                      onChange={(e) => {
                        setNewUrl(e.target.value);
                        if (urlError) setUrlError('');
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
                    id="search-online-exam"
                    checked={searchOnline}
                    onCheckedChange={(checked) => setSearchOnline(checked === true)}
                  />
                  <Label htmlFor="search-online-exam" className="text-sm">
                    Search online for additional context
                  </Label>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={loading} className="flex-1">
                {loading ? "Generating..." : "Generate Question"}
              </Button>
              {currentQuestion && (
                <Button onClick={handleGenerate} disabled={loading} variant="outline">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Next
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Question Editor */}
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-1">Question Editor</h3>
          <p className="text-sm text-muted-foreground">
            {currentQuestion 
              ? "Review and edit the generated question before saving or assigning"
              : "Generated question will appear here for editing"
            }
          </p>
        </div>

        {!currentQuestion ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No question generated yet. Use the form to create a question.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">Question Content</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {currentQuestion.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {currentQuestion.exam_type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question Stem */}
                  <div>
                    <Label htmlFor="stem">Question Stem</Label>
                    <Textarea
                      id="stem"
                      value={currentQuestion.stem}
                      onChange={(e) => updateQuestionField('stem', e.target.value)}
                      className={`mt-1 ${validationErrors.stem ? 'border-red-500' : ''}`}
                      rows={4}
                    />
                    {validationErrors.stem && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.stem}
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  <div>
                    <Label>Answer Options</Label>
                    <div className="space-y-2 mt-2">
                      {currentQuestion.options.map((option, index) => (
                        <div key={index} className={`p-3 border rounded-lg ${
                          option === currentQuestion.correct_answer 
                            ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                            : 'border-border'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                            <Button
                              size="sm"
                              variant={option === currentQuestion.correct_answer ? "default" : "outline"}
                              onClick={() => setCorrectAnswer(option)}
                            >
                              {option === currentQuestion.correct_answer ? "Correct" : "Mark Correct"}
                            </Button>
                          </div>
                          <Input
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            placeholder="Option text"
                            className={validationErrors.options ? 'border-red-500' : ''}
                          />
                        </div>
                      ))}
                    </div>
                    {validationErrors.options && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.options}
                      </div>
                    )}
                    {validationErrors.correct_answer && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.correct_answer}
                      </div>
                    )}
                  </div>

                  {/* Explanation */}
                  <div>
                    <Label htmlFor="explanation">Explanation</Label>
                    <Textarea
                      id="explanation"
                      value={currentQuestion.explanation || ''}
                      onChange={(e) => updateQuestionField('explanation', e.target.value)}
                      className={`mt-1 ${validationErrors.explanation ? 'border-red-500' : ''}`}
                      rows={3}
                      placeholder="Explanation of the correct answer"
                    />
                    {validationErrors.explanation && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.explanation}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={currentQuestion.tags?.join(', ') || ''}
                      onChange={(e) => updateQuestionField('tags', e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                      placeholder="e.g., cardiology, myocardial infarction"
                      className={validationErrors.tags ? 'border-red-500' : ''}
                    />
                    {validationErrors.tags && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {validationErrors.tags}
                      </div>
                    )}
                  </div>

                  {/* Reference */}
                  <div>
                    <Label htmlFor="reference">Reference (Optional)</Label>
                    <Input
                      id="reference"
                      value={currentQuestion.reference || ''}
                      onChange={(e) => updateQuestionField('reference', e.target.value)}
                      placeholder="Citation or reference"
                    />
                  </div>

                   {/* Guru Assignment */}
                   <div>
                     <Label htmlFor="assignGuru">Assign to Guru (Optional)</Label>
                     <Select value={selectedGuru} onValueChange={setSelectedGuru}>
                       <SelectTrigger className="mt-1">
                         <SelectValue placeholder="Select a guru for assignment" />
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

                   {/* Actions */}
                   <div className="flex gap-2 pt-4 border-t">
                     <Button onClick={handleSaveQuestion} disabled={loading} className="flex-1">
                       <Save className="w-4 h-4 mr-2" />
                       Save Draft
                     </Button>
                     <Button onClick={handleAssignGuru} disabled={loading || !selectedGuru} variant="secondary" className="flex-1">
                       <Users className="w-4 h-4 mr-2" />
                       {selectedGuru ? `Assign to ${getGuruName(selectedGuru)}` : "Assign for Review"}
                     </Button>
                     <Button onClick={handleDiscard} variant="outline" size="sm">
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="multimedia" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Question Multimedia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative text-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <div className="flex justify-center space-x-4 mb-4">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Upload images for your question</p>
                    <p className="text-sm text-muted-foreground mt-2">Supports JPG, PNG, GIF formats</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        // Handle image uploads for questions
                        console.log('Images uploaded:', files);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <p>• Images will be included with the question for reviewers</p>
                    <p>• Maximum file size: 5MB per image</p>
                    <p>• Recommended: High contrast images for medical diagrams</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-6">
            {/* Generation History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Question Generation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getGenerationHistory().length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No generation history yet. Generate your first question to see it here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {getGenerationHistory().map((log, index) => (
                      <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {log.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                              <h4 className="font-semibold truncate">{log.topic}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {log.instructions || 'No specific instructions'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{new Date(log.ts).toLocaleDateString()}</span>
                              <span>{log.urlCount} URLs</span>
                              <span>{log.fileCount} files</span>
                            </div>
                            {log.error && (
                              <p className="text-xs text-destructive mt-1">{log.error}</p>
                            )}
                          </div>
                          {log.success && log.question && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadFromHistory(log)}
                              className="ml-4"
                            >
                              Load
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}