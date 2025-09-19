import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, FileText, Flag, Edit, Trash2, RotateCcw, Save, Users, AlertCircle, Loader2, Check, X, UserPlus, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast-core';
import { DraftEditModal } from '@/components/DraftEditModal';
import { mapSlugToEnum, getAllExamDisplayNames, mapDisplayNameToEnum, type ExamDisplayName, type ExamTypeEnum } from '@/lib/examMapping';

interface ExamOption {
  enum_value: ExamTypeEnum;
  display_name: ExamDisplayName;
}

interface TopicOption {
  value: string;
  label: string;
}

interface GeneratedQuestion {
  id?: string;
  stem: string;
  options: { text: string; explanation: string }[];
  correctIndex: number;
  explanation: string;
  reference?: string;
  status: 'generated' | 'kept' | 'draft';
}

interface DraftQuestion extends GeneratedQuestion {
  id: string;
  assignedTo?: string;
  assignedGuruName?: string;
  createdAt: string;
}

interface Guru {
  id: string;
  name: string;
}

const QuestionGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  
  // Database data
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  
  // Generate tab state
  const [config, setConfig] = useState({
    exam: '' as ExamDisplayName | '',
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
  const [editForm, setEditForm] = useState<DraftQuestion | null>(null);
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);

  // Load exams and gurus
  useEffect(() => {
    const loadData = async () => {
      setLoadingExams(true);
      try {
        // Load exams from standardized mapping
        const examOptions: ExamOption[] = getAllExamDisplayNames().map(displayName => ({
          enum_value: mapDisplayNameToEnum(displayName),
          display_name: displayName
        }));

        setExams(examOptions);

        // Load gurus
        const { data: guruData, error: guruError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'guru');

        if (guruError) throw guruError;

        // Then get profiles for these users
        const guruIds = guruData?.map(r => r.user_id) || [];
        let guruList: Guru[] = [];
        
        if (guruIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', guruIds);

          if (profileError) throw profileError;

          guruList = profileData?.map(p => ({
            id: p.user_id,
            name: p.full_name || 'Unknown Guru'
          })) || [];
        }

        setGurus(guruList);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoadingExams(false);
      }
    };

    loadData();
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
        // Convert display name to enum value for database query
        const examTypeEnum = mapDisplayNameToEnum(config.exam as ExamDisplayName);
        
        if (examTypeEnum) {
          const { data, error } = await supabase
            .from('curriculum_map')
            .select('slo_title, key_capability_title')
            .eq('exam_type', examTypeEnum)
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
            console.warn(`No curriculum topics found for exam type: ${examTypeEnum}`);
            setTopics([{ value: 'all', label: 'All Topics' }]);
          }
        } else {
          console.warn(`No mapping found for exam: ${config.exam}`);
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

    const examTitle = exams.find(e => e.display_name === config.exam)?.display_name || config.exam;
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
      const examTitle = exams.find(e => e.display_name === config.exam)?.display_name || config.exam;
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

      // Convert drafts to review_exam_questions format using standardized exam_type
      const examTypeEnum = config.exam ? mapDisplayNameToEnum(config.exam as ExamDisplayName) : 'OTHER';
      const questionsToInsert = drafts.map(draft => ({
        question: draft.stem,
        options: draft.options.map(opt => opt.text),
        correct_answer: draft.options[draft.correctIndex].text,
        explanation: draft.explanation,
        exam_type: examTypeEnum,
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

  // Edit draft functionality
  const startEditDraft = (draft: DraftQuestion) => {
    setEditForm({ ...draft });
    setEditingDraft(draft);
  };

  const saveEditDraft = () => {
    if (!editForm || !editingDraft) return;
    
    setDrafts(prev => prev.map(d => 
      d.id === editingDraft.id ? editForm : d
    ));
    setEditForm(null);
    setEditingDraft(null);
    toast.success('Draft updated');
  };

  const cancelEditDraft = () => {
    setEditForm(null);
    setEditingDraft(null);
  };

  // Assign guru to draft
  const assignGuru = (draftId: string, guruId: string) => {
    const guru = gurus.find(g => g.id === guruId);
    setDrafts(prev => prev.map(d => 
      d.id === draftId 
        ? { ...d, assignedTo: guruId, assignedGuruName: guru?.name }
        : d
    ));
    toast.success('Guru assigned');
  };

  // Bulk assign functionality
  const bulkAssignGuru = (guruId: string) => {
    const guru = gurus.find(g => g.id === guruId);
    setDrafts(prev => prev.map(d => 
      selectedDrafts.includes(d.id)
        ? { ...d, assignedTo: guruId, assignedGuruName: guru?.name }
        : d
    ));
    setSelectedDrafts([]);
    setBulkAssignMode(false);
    toast.success(`Assigned ${selectedDrafts.length} drafts to ${guru?.name}`);
  };

  const toggleDraftSelection = (draftId: string) => {
    setSelectedDrafts(prev => 
      prev.includes(draftId)
        ? prev.filter(id => id !== draftId)
        : [...prev, draftId]
    );
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
              <div key={index} className={`p-3 rounded border text-sm ${
                index === question.correctIndex 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
              }`}>
                <div className="font-medium mb-1">
                  <span className="font-bold">{String.fromCharCode(65 + index)}.</span> {typeof option === 'string' ? option : option.text}
                </div>
                {typeof option === 'object' && option.explanation && (
                  <div className="text-xs text-muted-foreground italic">
                    {option.explanation}
                  </div>
                )}
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
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'generate' as const, label: 'Generate' },
          { id: 'drafts' as const, label: 'Drafts' },
          { id: 'marked' as const, label: 'Marked' },
        ].map(tab => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
            {tab.id === 'drafts' && drafts.length > 0 && (
              <Badge variant="secondary" className="ml-2">{drafts.length}</Badge>
            )}
          </Button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="space-y-6">

        
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Generation Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Exam Type</label>
                  <Select value={config.exam} onValueChange={(value) => setConfig(prev => ({ ...prev, exam: value as ExamDisplayName | '' }))}>
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
                          <SelectItem key={exam.enum_value} value={exam.display_name}>
                            {exam.display_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Curriculum Topic</label>
                  <Select 
                    value={config.topic} 
                    onValueChange={(value) => setConfig(prev => ({ ...prev, topic: value }))}
                    disabled={!config.exam}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={config.exam ? "Select curriculum topic" : "Select exam first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingTopics ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : topics.length === 0 && config.exam ? (
                        <SelectItem value="no-topics" disabled>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            No curriculum topics available for this exam
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
        </div>
      )}

      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Draft Questions ({drafts.length})</h3>
            <div className="flex gap-2">
              {drafts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkAssignMode(!bulkAssignMode);
                    setSelectedDrafts([]);
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {bulkAssignMode ? 'Cancel Bulk' : 'Bulk Assign'}
                </Button>
              )}
              
              {bulkAssignMode && selectedDrafts.length > 0 && (
                <Select onValueChange={bulkAssignGuru}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Assign to guru" />
                  </SelectTrigger>
                  <SelectContent>
                    {gurus.map(guru => (
                      <SelectItem key={guru.id} value={guru.id}>
                        {guru.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button 
                onClick={commitAllDrafts} 
                disabled={drafts.length === 0 || committingDrafts}
                className="text-sm"
              >
                {committingDrafts ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Commit All ({drafts.length})
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {drafts.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No draft questions yet. Generate some questions and keep them as drafts.</p>
              </Card>
            ) : (
              drafts.map((draft) => (
                <Card key={draft.id} className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    {bulkAssignMode && (
                      <div className="flex items-center mr-3">
                        <input
                          type="checkbox"
                          checked={selectedDrafts.includes(draft.id)}
                          onChange={() => toggleDraftSelection(draft.id)}
                          className="w-4 h-4"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-3">{draft.stem}</p>
                      <div className="space-y-2">
                        {draft.options.map((option, index) => (
                          <div key={index} className={`p-3 rounded border text-sm ${
                            index === draft.correctIndex 
                              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                              : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                          }`}>
                            <div className="font-medium mb-1">
                              <span className="font-bold">{String.fromCharCode(65 + index)}.</span> {typeof option === 'string' ? option : option.text}
                            </div>
                            {typeof option === 'object' && option.explanation && (
                              <div className="text-xs text-muted-foreground italic">
                                {option.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {draft.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                          <p className="text-sm"><strong>Overall Explanation:</strong> {draft.explanation}</p>
                        </div>
                      )}
                      
                      {draft.reference && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground"><strong>Reference:</strong> {draft.reference}</p>
                        </div>
                      )}
                      
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Created: {new Date(draft.createdAt).toLocaleString()}</span>
                        {draft.assignedGuruName ? (
                          <Badge variant="default">Assigned to {draft.assignedGuruName}</Badge>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="ghost" onClick={() => startEditDraft(draft)} className="text-xs">
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    {!draft.assignedTo && (
                      <Select onValueChange={(guruId) => assignGuru(draft.id, guruId)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {gurus.map(guru => (
                            <SelectItem key={guru.id} value={guru.id}>
                              {guru.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <Button size="sm" variant="outline" onClick={() => removeDraft(draft.id)} className="text-xs">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'marked' && (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <Flag className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Marked questions functionality coming soon.</p>
          </Card>
        </div>
      )}
      

      {/* Draft Edit Modal */}
      <DraftEditModal
        open={!!editingDraft}
        draft={editingDraft}
        gurus={gurus}
        onSave={saveEditDraft}
        onCancel={cancelEditDraft}
        formData={editForm}
        setFormData={setEditForm}
      />
    </div>
  );
};

export default QuestionGenerator;
