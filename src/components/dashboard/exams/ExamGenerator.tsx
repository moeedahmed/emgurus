import { useState } from "react";
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
import { Save, Users, Trash2, ArrowRight } from "lucide-react";

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

export default function ExamGenerator() {
  const { user, loading: userLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<EditableQuestion | null>(null);
  const [generationCount, setGenerationCount] = useState(0);
  const [formData, setFormData] = useState({
    topic: '',
    difficulty: 'medium',
    examType: 'mrcem_sba',
    instructions: ''
  });
  const { toast } = useToast();

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading generator…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to use the exam generator.</div>;
  }

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for question generation.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
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
    
    setLoading(true);
    try {
      // Create draft using supabase RPC
      const { data, error } = await supabase.rpc('create_exam_draft', {
        p_stem: currentQuestion.stem,
        p_choices: currentQuestion.options.map((opt, idx) => ({ 
          text: opt, 
          explanation: '' 
        })),
        p_correct_index: Math.max(0, currentQuestion.options.indexOf(currentQuestion.correct_answer)),
        p_explanation: currentQuestion.explanation || '',
        p_tags: currentQuestion.tags || [],
        p_exam_type: 'OTHER' as any
      });

      if (error) throw error;
      
      toast({
        title: "Question Saved",
        description: "Question saved to drafts successfully.",
      });
      
      // Clear current question
      setCurrentQuestion(null);
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast({
        title: "Save Failed",
        description: error?.message || "Unable to save question. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGuru = async () => {
    if (!currentQuestion) return;
    
    setLoading(true);
    try {
      // First save as draft
      const { data: draftData, error: draftError } = await supabase.rpc('create_exam_draft', {
        p_stem: currentQuestion.stem,
        p_choices: currentQuestion.options.map((opt, idx) => ({ 
          text: opt, 
          explanation: '' 
        })),
        p_correct_index: Math.max(0, currentQuestion.options.indexOf(currentQuestion.correct_answer)),
        p_explanation: currentQuestion.explanation || '',
        p_tags: currentQuestion.tags || [],
        p_exam_type: 'OTHER' as any
      });

      if (draftError) throw draftError;
      
      // Submit for review
      const { error: submitError } = await supabase.rpc('submit_exam_for_review', {
        p_question_id: draftData[0]?.id
      });

      if (submitError) throw submitError;
      
      toast({
        title: "Question Assigned",
        description: "Question saved and submitted for guru review.",
      });
      
      // Clear current question
      setCurrentQuestion(null);
    } catch (error: any) {
      console.error('Error assigning question:', error);
      toast({
        title: "Assignment Failed",
        description: error?.message || "Unable to assign question. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setCurrentQuestion(null);
    toast({
      description: "Question discarded.",
    });
  };

  const updateQuestionField = (field: keyof EditableQuestion, value: any) => {
    if (!currentQuestion) return;
    setCurrentQuestion({ ...currentQuestion, [field]: value });
  };

  const updateOption = (index: number, value: string) => {
    if (!currentQuestion) return;
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const setCorrectAnswer = (option: string) => {
    if (!currentQuestion) return;
    setCurrentQuestion({ ...currentQuestion, correct_answer: option });
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
                      className="mt-1"
                      rows={4}
                    />
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
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <Label htmlFor="explanation">Explanation</Label>
                    <Textarea
                      id="explanation"
                      value={currentQuestion.explanation || ''}
                      onChange={(e) => updateQuestionField('explanation', e.target.value)}
                      className="mt-1"
                      rows={3}
                      placeholder="Explanation of the correct answer"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={currentQuestion.tags?.join(', ') || ''}
                      onChange={(e) => updateQuestionField('tags', e.target.value.split(',').map(t => t.trim()))}
                      placeholder="e.g., cardiology, myocardial infarction"
                    />
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

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={handleSaveQuestion} disabled={loading} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button onClick={handleAssignGuru} disabled={loading} variant="secondary" className="flex-1">
                      <Users className="w-4 h-4 mr-2" />
                      Assign Guru
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