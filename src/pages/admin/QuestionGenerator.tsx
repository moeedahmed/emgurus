import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';
import { Brain, FileText, Flag, Edit, Trash2, RotateCcw, Save, Users } from 'lucide-react';

// Mock data for demonstration
const mockGeneratedQuestions = [
  {
    id: 1,
    stem: "A 35-year-old patient presents with chest pain and shortness of breath. ECG shows ST elevation in leads II, III, and aVF. What is the most likely diagnosis?",
    options: [
      "Anterior STEMI",
      "Inferior STEMI", 
      "Lateral STEMI",
      "Posterior STEMI",
      "NSTEMI"
    ],
    correctIndex: 1,
    explanation: "ST elevation in leads II, III, and aVF indicates inferior wall myocardial infarction, typically caused by occlusion of the right coronary artery.",
    reference: "Thygesen K, et al. Fourth Universal Definition of Myocardial Infarction. Circulation. 2018.",
    status: 'generated'
  }
];

const mockDrafts = [
  {
    id: 1,
    stem: "A 28-year-old presents with sudden onset severe headache described as 'worst headache of my life'. What is the most appropriate immediate investigation?",
    options: [
      "CT head without contrast",
      "MRI brain with contrast",
      "Lumbar puncture",
      "CT angiogram head and neck",
      "Carotid doppler ultrasound"
    ],
    correctIndex: 0,
    explanation: "CT head without contrast is the first-line investigation for suspected subarachnoid hemorrhage.",
    reference: "van Gijn J, et al. Subarachnoid hemorrhage. Lancet. 2007.",
    assignedTo: null,
    createdAt: '2024-01-15'
  }
];

const mockMarkedQuestions = [
  {
    id: 1,
    stem: "In cardiogenic shock, which medication should be avoided?",
    feedback: "This question seems too vague - there are multiple medications that should be avoided in cardiogenic shock. Could be more specific about the clinical scenario.",
    flaggedBy: "Dr. Smith",
    flaggedAt: "2024-01-14"
  }
];

const mockGurus = [
  { id: 1, name: "Dr. Sarah Johnson" },
  { id: 2, name: "Dr. Michael Chen" },
  { id: 3, name: "Dr. Emma Wilson" }
];

const QuestionGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [generatedQuestions, setGeneratedQuestions] = useState(mockGeneratedQuestions);
  const [drafts, setDrafts] = useState(mockDrafts);
  const [markedQuestions] = useState(mockMarkedQuestions);
  
  // Generate tab state
  const [config, setConfig] = useState({
    exam: '',
    topic: '',
    difficulty: '',
    count: '5',
    prompt: ''
  });

  // Edit states
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [editingDraft, setEditingDraft] = useState<any>(null);

  const handleGenerate = () => {
    // Mock generation - in real implementation, this would call an API
    console.log('Generating questions with config:', config);
  };

  const handleKeep = (questionId: number) => {
    const question = generatedQuestions.find(q => q.id === questionId);
    if (question) {
      setGeneratedQuestions(prev => prev.filter(q => q.id !== questionId));
      // Would add to drafts in real implementation
    }
  };

  const handleDiscard = (questionId: number) => {
    setGeneratedQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const handleCommitDrafts = () => {
    // Mock commit - would save to database
    console.log('Committing selected drafts');
  };

  const handleSaveDraft = (draft: any) => {
    setDrafts(prev => prev.map(d => d.id === draft.id ? draft : d));
    setEditingDraft(null);
  };

  return (
    <RoleProtectedRoute roles={['admin']}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Question Generator</h1>
          <p className="text-muted-foreground">Generate, curate, and manage exam questions with AI assistance</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Generate</span>
            </TabsTrigger>
            <TabsTrigger value="drafts" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Drafts</span>
              {drafts.length > 0 && <Badge variant="secondary">{drafts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="marked" className="flex items-center gap-2">
              <Flag className="w-4 h-4" />
              <span className="hidden sm:inline">Marked</span>
              {markedQuestions.length > 0 && <Badge variant="destructive">{markedQuestions.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            {/* Configuration Panel */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Generation Config</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Exam Type</label>
                  <Select value={config.exam} onValueChange={(value) => setConfig(prev => ({ ...prev, exam: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mrcem">MRCEM</SelectItem>
                      <SelectItem value="frcem">FRCEM</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Topic</label>
                  <Input 
                    placeholder="e.g., Cardiology"
                    value={config.topic}
                    onChange={(e) => setConfig(prev => ({ ...prev, topic: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Difficulty</label>
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
                  <label className="text-sm font-medium mb-2 block">Count</label>
                  <Input 
                    type="number"
                    min="1"
                    max="10"
                    value={config.count}
                    onChange={(e) => setConfig(prev => ({ ...prev, count: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Additional Prompt (Optional)</label>
                <Textarea 
                  placeholder="Any specific requirements or focus areas..."
                  value={config.prompt}
                  onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <Button onClick={handleGenerate} className="w-full sm:w-auto">
                <Brain className="w-4 h-4 mr-2" />
                Generate Questions
              </Button>
            </Card>

            {/* Generated Questions */}
            {generatedQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Generated Questions</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGeneratedQuestions([])}>
                      Discard All
                    </Button>
                    <Button size="sm" onClick={handleCommitDrafts}>
                      Commit {generatedQuestions.length} Drafts
                    </Button>
                  </div>
                </div>
                
                {generatedQuestions.map((question) => (
                  <Card key={question.id} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Question</h4>
                        <p className="text-sm">{question.stem}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Options</h4>
                        <div className="space-y-1">
                          {question.options.map((option, index) => (
                            <div key={index} className={`text-sm p-2 rounded ${index === question.correctIndex ? 'bg-success/10 border border-success/20' : 'bg-muted/50'}`}>
                              <span className="font-mono mr-2">{String.fromCharCode(65 + index)}.</span>
                              {option}
                              {index === question.correctIndex && <Badge variant="default" className="ml-2 text-xs">Correct</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Explanation</h4>
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                      
                      {question.reference && (
                        <div>
                          <h4 className="font-medium mb-2">Reference</h4>
                          <p className="text-xs text-muted-foreground">{question.reference}</p>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex flex-wrap gap-2">
                        <Button variant="default" size="sm" onClick={() => handleKeep(question.id)}>
                          Keep
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingQuestion(question)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Regenerate
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDiscard(question.id)}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Discard
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Question Drafts</h3>
              <Badge variant="secondary">{drafts.length} drafts</Badge>
            </div>
            
            {drafts.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No drafts available. Generate some questions first!</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <Card key={draft.id} className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{draft.stem}</p>
                          <p className="text-xs text-muted-foreground mt-1">Created: {draft.createdAt}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button variant="outline" size="sm" onClick={() => setEditingDraft(draft)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                      
                      {draft.assignedTo && (
                        <Badge variant="secondary">Assigned to: {draft.assignedTo}</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="marked" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Flagged Questions</h3>
              <Badge variant="destructive">{markedQuestions.length} flagged</Badge>
            </div>
            
            {markedQuestions.length === 0 ? (
              <Card className="p-8 text-center">
                <Flag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No flagged questions. Great job!</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {markedQuestions.map((question) => (
                  <Card key={question.id} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Question</h4>
                        <p className="text-sm">{question.stem}</p>
                      </div>
                      
                      <div className="bg-destructive/10 border border-destructive/20 p-4 rounded">
                        <h4 className="font-medium mb-2 text-destructive">User Feedback</h4>
                        <p className="text-sm">{question.feedback}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Flagged by {question.flaggedBy} on {question.flaggedAt}
                        </p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Admin Response</label>
                        <Textarea placeholder="Add your response..." rows={3} />
                        <Button size="sm" className="mt-2">Send Response</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Draft Modal (simplified inline for now) */}
        {editingDraft && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Edit Draft</h3>
                  <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)}>
                    Cancel
                  </Button>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Question</label>
                  <Textarea 
                    value={editingDraft.stem}
                    onChange={(e) => setEditingDraft(prev => ({ ...prev, stem: e.target.value }))}
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Assign to Guru</label>
                  <Select 
                    value={editingDraft.assignedTo || ''} 
                    onValueChange={(value) => setEditingDraft(prev => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select guru (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockGurus.map(guru => (
                        <SelectItem key={guru.id} value={guru.name}>{guru.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveDraft(editingDraft)}>
                    <Save className="w-4 h-4 mr-2" />
                    Save & Assign
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </RoleProtectedRoute>
  );
};

export default QuestionGenerator;