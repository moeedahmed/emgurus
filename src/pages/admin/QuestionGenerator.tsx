import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, FileText, Flag, Edit, Trash2, RotateCcw, Save, Users, AlertCircle, Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExamOption {
  slug: string;
  title: string;
}

interface TopicOption {
  value: string;
  label: string;
}

interface GeneratedQuestion {
  id?: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference?: string;
  status: 'generated' | 'kept' | 'draft';
}

interface DraftQuestion extends GeneratedQuestion {
  id: string;
  assignedTo?: string;
  createdAt: string;
}

const mockGurus = [
  { id: 1, name: "Dr. Sarah Johnson" },
  { id: 2, name: "Dr. Michael Chen" },
  { id: 3, name: "Dr. Emma Wilson" }
];

const QuestionGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  
  // Database data
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  
  // Generate tab state
  const [config, setConfig] = useState({
    exam: '',
    topic: '',
    difficulty: '',
    count: '5',
    prompt: ''
  });
  
  // Generated questions state
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  
  // Draft state
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [committingDrafts, setCommittingDrafts] = useState(false);
  
  // Edit states
  const [editingQuestion, setEditingQuestion] = useState<GeneratedQuestion | null>(null);
  const [editingDraft, setEditingDraft] = useState<DraftQuestion | null>(null);

  // Load exams from taxonomy terms
  useEffect(() => {
    const loadExams = async () => {
      setLoadingExams(true);
      try {
        const { data, error } = await supabase
          .from('taxonomy_terms')
          .select('slug, title')
          .eq('kind', 'exam')
          .order('title');

        if (error) throw error;

        const examOptions = data?.map(item => ({
          slug: item.slug,
          title: item.title
        })) || [];

        setExams(examOptions);
      } catch (error) {
        console.error('Error loading exams:', error);
        toast.error('Failed to load exams');
      } finally {
        setLoadingExams(false);
      }
    };

    loadExams();
  }, []);

  // Load topics when exam changes
  useEffect(() => {
    if (!config.exam) {
      setTopics([]);
      return;
    }

    const loadTopics = async () => {
      setLoadingTopics(true);
      try {
        // Enhanced exam slug to enum mapping - centralized source of truth
        const examTypeMap: Record<string, string> = {
          'mrcem-primary': 'MRCEM_PRIMARY',
          'mrcem-sba': 'MRCEM_SBA', 
          'frcem-sba': 'FRCEM_SBA',
          'fcps-part1': 'FCPS_PART1',
          'fcps-part1-pk': 'FCPS_PART1',
          'fcps-part2': 'FCPS_PART2',
          'fcps-part2-pk': 'FCPS_PART2',
          'fcps-imm': 'FCPS_IMM',
          'fcps-imm-pk': 'FCPS_IMM',
          'fcps-em-pk': 'FCPS_IMM', // Emergency Medicine maps to IMM for curriculum
          'fcps-emergency-medicine': 'FCPS_IMM'
        };

        const examType = examTypeMap[config.exam];
        
        if (examType) {
          const { data, error } = await supabase
            .from('curriculum_map')
            .select('slo_title, key_capability_title')
            .eq('exam_type', examType as any)
            .order('slo_title');

          if (error) throw error;

          if (data && data.length > 0) {
            const topicOptions = data.map(item => ({
              value: item.slo_title,
              label: `${item.key_capability_title}: ${item.slo_title}`
            }));

            // Remove duplicates and add "All Topics" option
            const uniqueTopics = Array.from(
              new Map(topicOptions.map(t => [t.value, t])).values()
            );

            setTopics([
              { value: 'all', label: 'All Topics' },
              ...uniqueTopics
            ]);
          } else {
            console.warn(`No curriculum topics found for exam type: ${examType}`);
            setTopics([{ value: 'all', label: 'All Topics' }]);
          }
        } else {
          console.warn(`No mapping found for exam slug: ${config.exam}`);
          setTopics([{ value: 'all', label: 'All Topics' }]);
        }
      } catch (error) {
        console.error('Error loading topics:', error);
        toast.error('Failed to load topics');
        setTopics([{ value: 'all', label: 'All Topics' }]);
      } finally {
        setLoadingTopics(false);
      }
    };

    loadTopics();
  }, [config.exam]);

  // Reset topic when exam changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, topic: '' }));
  }, [config.exam]);

  // Generate live prompt preview
  const getPromptPreview = () => {
    if (!config.exam || !config.difficulty || !config.count) {
      return 'Please select exam, difficulty, and count to see prompt preview...';
    }

    const examTitle = exams.find(e => e.slug === config.exam)?.title || config.exam;
    const topicText = config.topic && config.topic !== 'all' 
      ? ` on ${topics.find(t => t.value === config.topic)?.label || config.topic}`
      : '';
    
    let prompt = `Generate ${config.count} ${config.difficulty}-level MCQs${topicText} for the ${examTitle} exam using the latest curriculum guidelines.`;
    
    if (config.prompt) {
      prompt += `\n\nAdditional instructions: ${config.prompt}`;
    }
    
    return prompt;
  };

  // Generate questions via OpenAI
  const generateQuestions = async () => {
    if (!config.exam || !config.difficulty || !config.count) {
      toast.error('Please select exam, difficulty, and count');
      return;
    }

    // Log for analytics/debugging
    console.log('Generation request:', {
      exam: config.exam,
      topic: config.topic,
      difficulty: config.difficulty,
      count: config.count,
      timestamp: new Date().toISOString()
    });

    setGenerating(true);
    try {
      const examTitle = exams.find(e => e.slug === config.exam)?.title || config.exam;
      const topicValue = config.topic === 'all' ? undefined : config.topic;

      const { data, error } = await supabase.functions.invoke('generate-ai-question', {
        body: {
          exam: examTitle,
          topic: topicValue,
          difficulty: config.difficulty,
          count: parseInt(config.count),
          customPrompt: config.prompt || undefined
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Generation failed. Please verify exam-topic mapping and try again.');
      }

      const questions: GeneratedQuestion[] = data.questions.map((q: any, index: number) => ({
        id: `gen_${Date.now()}_${index}`,
        stem: q.stem,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        reference: q.reference,
        status: 'generated' as const
      }));

      setGeneratedQuestions(questions);
      toast.success(`Generated ${questions.length} questions successfully!`);
      
      console.log('Final prompt used:', data.prompt);
      console.log('Generated questions:', questions.length);
      
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Keep question as draft
  const keepQuestion = (question: GeneratedQuestion) => {
    const draftQuestion: DraftQuestion = {
      ...question,
      id: question.id || `draft_${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString()
    };
    
    setDrafts(prev => [...prev, draftQuestion]);
    setGeneratedQuestions(prev => prev.filter(q => q.id !== question.id));
    toast.success('Question moved to drafts');
  };

  // Discard question
  const discardQuestion = (questionId: string) => {
    setGeneratedQuestions(prev => prev.filter(q => q.id !== questionId));
    toast.success('Question discarded');
  };

  // Commit all drafts to database
  const commitAllDrafts = async () => {
    if (drafts.length === 0) {
      toast.error('No drafts to commit');
      return;
    }

    setCommittingDrafts(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Convert drafts to review_exam_questions format
      const questionsToInsert = drafts.map(draft => ({
        question: draft.stem,
        options: draft.options,
        correct_answer: draft.options[draft.correctIndex],
        explanation: draft.explanation,
        exam_type: 'OTHER' as const,
        status: 'draft' as const,
        created_by: user.id
      }));

      const { error } = await supabase
        .from('review_exam_questions')
        .insert(questionsToInsert);

      if (error) throw error;

      toast.success(`Successfully committed ${drafts.length} questions to database`);
      setDrafts([]);
      
    } catch (error: any) {
      console.error('Commit error:', error);
      toast.error(`Failed to commit drafts: ${error.message}`);
    } finally {
      setCommittingDrafts(false);
    }
  };

  // Remove draft
  const removeDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    toast.success('Draft removed');
  };

  const QuestionCard = ({ question, showActions = true, onKeep, onDiscard, onEdit }: {
    question: GeneratedQuestion;
    showActions?: boolean;
    onKeep?: () => void;
    onDiscard?: () => void;
    onEdit?: () => void;
  }) => (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm mb-3">{question.stem}</p>
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className={`p-2 rounded border text-sm ${
                index === question.correctIndex 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
              }`}>
                <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
              </div>
            ))}
          </div>
          
          {question.explanation && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm"><strong>Explanation:</strong> {question.explanation}</p>
            </div>
          )}
          
          {question.reference && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground"><strong>Reference:</strong> {question.reference}</p>
            </div>
          )}
        </div>
      </div>
      
      {showActions && (
        <div className="flex gap-2 pt-2 border-t">
          {onKeep && (
            <Button size="sm" onClick={onKeep} className="text-xs">
              <Check className="w-3 h-3 mr-1" />
              Keep
            </Button>
          )}
          {onDiscard && (
            <Button size="sm" variant="outline" onClick={onDiscard} className="text-xs">
              <X className="w-3 h-3 mr-1" />
              Discard
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit} className="text-xs">
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI Question Generator</h1>
          <p className="text-sm text-muted-foreground">Generate high-quality MCQs using AI</p>
        </div>
        <Badge variant="outline" className="ml-auto">Beta</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts {drafts.length > 0 && <Badge variant="secondary" className="ml-2">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="marked">Marked Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Generation Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Exam Type</label>
                  <Select value={config.exam} onValueChange={(value) => setConfig(prev => ({ ...prev, exam: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam type" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingExams ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : exams.length === 0 ? (
                        <SelectItem value="no-exams" disabled>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            No exams available — please seed the exams database
                          </div>
                        </SelectItem>
                      ) : (
                        exams.map((exam) => (
                          <SelectItem key={exam.slug} value={exam.slug}>
                            {exam.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Topic</label>
                  <Select 
                    value={config.topic} 
                    onValueChange={(value) => setConfig(prev => ({ ...prev, topic: value }))}
                    disabled={!config.exam}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={config.exam ? "Select topic" : "Select exam first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingTopics ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : topics.length === 0 && config.exam ? (
                        <SelectItem value="no-topics" disabled>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            No topics available for this exam
                          </div>
                        </SelectItem>
                      ) : (
                        topics.map((topic) => (
                          <SelectItem key={topic.value} value={topic.value}>
                            {topic.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Difficulty</label>
                    <Select value={config.difficulty} onValueChange={(value) => setConfig(prev => ({ ...prev, difficulty: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Count</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={config.count}
                      onChange={(e) => setConfig(prev => ({ ...prev, count: e.target.value }))}
                      placeholder="Number of questions"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Additional Instructions (Optional)</label>
                  <Textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="e.g., Focus on differential diagnosis, include recent guidelines..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={generateQuestions} 
                  disabled={!config.exam || !config.difficulty || !config.count || generating || exams.length === 0}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Questions...
                    </>
                  ) : exams.length === 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      No Exams Available
                    </>
                  ) : !config.exam || !config.difficulty || !config.count ? (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Please Complete Configuration
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate Questions (Beta)
                    </>
                  )}
                </Button>
                
                {/* Analytics logging note */}
                {config.exam && config.difficulty && config.count && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Request will be logged: {config.exam} | {config.topic || 'All Topics'} | {config.difficulty}
                  </div>
                )}
              </div>
            </Card>

            {/* Prompt Preview */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Prompt Preview</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{getPromptPreview()}</p>
              </div>
            </Card>
          </div>

          {/* Generated Questions */}
          {generatedQuestions.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Generated Questions</h3>
              <div className="space-y-4">
                {generatedQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onKeep={() => keepQuestion(question)}
                    onDiscard={() => discardQuestion(question.id!)}
                    onEdit={() => setEditingQuestion(question)}
                  />
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Draft Questions ({drafts.length})</h3>
            {drafts.length > 0 && (
              <Button onClick={commitAllDrafts} disabled={committingDrafts}>
                {committingDrafts ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Commit All Drafts
                  </>
                )}
              </Button>
            )}
          </div>

          {drafts.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No draft questions yet. Generate some questions and keep them as drafts.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <QuestionCard
                  key={draft.id}
                  question={draft}
                  showActions={true}
                  onDiscard={() => removeDraft(draft.id)}
                  onEdit={() => setEditingDraft(draft)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marked" className="space-y-6">
          <h3 className="text-lg font-semibold">Marked Questions</h3>
          <Card className="p-8 text-center">
            <Flag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No marked questions yet. This feature will show questions flagged for review.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuestionGenerator;
