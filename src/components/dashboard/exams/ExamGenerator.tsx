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
import { Save, Users, Trash2, ArrowRight, AlertCircle } from "lucide-react";

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
    difficulty: 'medium',
    examType: 'mrcem_sba',
    instructions: ''
  });
  const [gurus, setGurus] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [selectedGuru, setSelectedGuru] = useState("");
  const { toast } = useToast();

  // Load gurus on component mount
  useEffect(() => {
    loadGurus();
  }, []);

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

    if (!formData.topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for question generation.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setValidationErrors({});
    try {
    const payload = {
      action: "bulk_generate",
      exam_type: formData.examType,
      topic: formData.topic,
      difficulty: formData.difficulty,
      count: 1,
      persistAsDraft: false, // Don't auto-save, let user decide
      instructions: formData.instructions || undefined
    };

      const result = await callFunction("/ai-exams-api", payload, true);
      
      if (result?.items && Array.isArray(result.items) && result.items.length > 0) {
        const question = result.items[0];
        const optionsArray = question.options && typeof question.options === 'object' && !Array.isArray(question.options)
          ? Object.values(question.options)
          : question.options || [];
        
        const newQuestion: EditableQuestion = {
          id: `generated-${Date.now()}`,
          stem: question.question || question.stem || '',
          options: optionsArray,
          correct_answer: question.correct || question.correct_answer || question.answer || '',
          explanation: question.explanation || '',
          exam_type: formData.examType,
          topic: question.topic || formData.topic,
          difficulty: formData.difficulty,
          tags: question.subtopic ? [question.subtopic] : [],
          reference: question.reference || question.source || '',
          isEditing: true
        };
        
        setCurrentQuestion(newQuestion);
        originalQuestionRef.current = { ...newQuestion };
        setHasUnsavedChanges(false);
        setGenerationCount(prev => prev + 1);
        
        toast({
          title: "Question Generated",
          description: `New question created for ${formData.topic}`,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Error generating questions:', error);
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
      // Map exam type to proper enum value
      const mapExamType = (type: string) => {
        switch (type) {
          case 'mrcem_sba': return 'MRCEM_SBA';
          case 'frcem_sba': return 'FRCEM_SBA';
          case 'mrcem_primary': return 'MRCEM_PRIMARY';
          case 'fcps_part1': return 'FCPS_PART1';
          case 'fcps_imm': return 'FCPS_IMM';
          default: return 'OTHER';
        }
      };

      // Use the create_exam_draft RPC function for proper draft creation
      const { data, error } = await supabase
        .from("review_exam_questions")
        .insert({
          question: currentQuestion.stem,
          options: currentQuestion.options,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation || '',
          exam_type: mapExamType(currentQuestion.exam_type || formData.examType),
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
      // Map exam type to proper enum value
      const mapExamType = (type: string) => {
        switch (type) {
          case 'mrcem_sba': return 'MRCEM_SBA';
          case 'frcem_sba': return 'FRCEM_SBA';
          case 'mrcem_primary': return 'MRCEM_PRIMARY';
          case 'fcps_part1': return 'FCPS_PART1';
          case 'fcps_imm': return 'FCPS_IMM';
          default: return 'OTHER';
        }
      };

      // Step 1: Create draft question
      const { data: savedQuestion, error: saveError } = await supabase
        .from("review_exam_questions")
        .insert({
          question: currentQuestion.stem,
          options: currentQuestion.options,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation || '',
          exam_type: mapExamType(currentQuestion.exam_type || formData.examType),
          created_by: user.id,
          status: 'under_review',
          submitted_at: new Date().toISOString(),
          assigned_to: selectedGuru,
          assigned_by: user.id
        })
        .select("*")
        .single();

      if (saveError) throw saveError;

      // Step 2: Create assignment record
      const { error: assignError } = await supabase
        .from("exam_review_assignments")
        .insert({
          question_id: savedQuestion.id,
          reviewer_id: selectedGuru,
          assigned_by: user.id,
          status: 'pending_review',
          assigned_at: new Date().toISOString(),
          notes: `Auto-assigned via Generator on ${new Date().toLocaleDateString()}`
        });

      if (assignError) throw assignError;
      
      console.log('Question saved and assigned:', savedQuestion.id);
      
      toast({
        title: "Question Assigned",
        description: `Question assigned to ${getGuruName(selectedGuru)} (ID: ${savedQuestion.id.slice(0, 8)}...)`,
      });
      
      // Reset state
      setCurrentQuestion(null);
      originalQuestionRef.current = null;
      setHasUnsavedChanges(false);
      setValidationErrors({});
      setSelectedGuru("");
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
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Cardiology, Emergency Medicine"
              />
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
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Multimedia support (images, videos, audio) will be available here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}