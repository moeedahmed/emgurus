import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import { EXAMS, CURRICULA, ExamName } from "@/lib/curricula";
import { Loader2, Copy, Edit, Trash2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

interface GeneratedQuestion {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  reference?: string;
  kept?: boolean;
}

const DIFFICULTIES = [
  { value: "basic", label: "Basic" },
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Advanced" }
];

const KNOWLEDGE_SOURCES = [
  { id: "textbooks", label: "Medical Textbooks" },
  { id: "guidelines", label: "Clinical Guidelines" },
  { id: "journals", label: "Peer-reviewed Journals" },
  { id: "case_studies", label: "Case Studies" }
];

export default function Generator() {
  const { toast } = useToast();
  
  // Configuration state
  const [exam, setExam] = useState<ExamName | "">("");
  const [topic, setTopic] = useState<string>("all");
  const [subtopic, setSubtopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("standard");
  const [count, setCount] = useState<number>(5);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([]);
  const [useTemperature, setUseTemperature] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.3);
  
  // Results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedQuestion[]>([]);
  const [costEstimate, setCostEstimate] = useState<number>(0);
  
  // Prompt state
  const [promptTemplate, setPromptTemplate] = useState<string>("");
  
  // Calculate cost estimate when config changes
  useEffect(() => {
    const baseCost = count * 0.05; // Rough estimate
    const complexityMultiplier = difficulty === "advanced" ? 1.5 : difficulty === "basic" ? 0.8 : 1;
    setCostEstimate(baseCost * complexityMultiplier);
  }, [count, difficulty]);

  // Load prompt template based on exam
  useEffect(() => {
    if (exam) {
      setPromptTemplate(`Create ${count} high-quality multiple choice questions for ${exam}${topic && topic !== "all" ? ` on topic ${topic}` : ''}${subtopic ? ` focusing on ${subtopic}` : ''}.

Difficulty level: ${difficulty}

Each question should:
- Have a clear, clinical stem
- Include 5 options (A-E)
- Have one correct answer
- Include a detailed explanation
- Reference relevant guidelines or sources

Format as strict JSON with: stem, options, correct_index, explanation, reference`);
    }
  }, [exam, topic, subtopic, difficulty, count]);

  const handleGenerate = async () => {
    if (!exam) {
      toast({ title: "Error", description: "Please select an exam type", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await callFunction('/admin-generate-questions', {
        exam,
        topic: topic && topic !== "all" ? topic : null,
        count,
        difficulty,
        knowledge_sources: knowledgeSources,
        use_temperature: useTemperature,
        temperature: useTemperature ? temperature : undefined,
        prompt_template: promptTemplate
      });

      if (response.questions) {
        const questionsWithIds = response.questions.map((q: any, index: number) => ({
          ...q,
          id: `generated-${Date.now()}-${index}`,
          kept: false
        }));
        setResults(questionsWithIds);
        toast({ title: "Success", description: `Generated ${questionsWithIds.length} questions` });
      } else {
        toast({ title: "Error", description: "No questions generated", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({ 
        title: "Generation Failed", 
        description: error.message || "Failed to generate questions", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = (questionId: string) => {
    setResults(prev => prev.map(q => 
      q.id === questionId ? { ...q, kept: !q.kept } : q
    ));
  };

  const handleKeepAll = () => {
    setResults(prev => prev.map(q => ({ ...q, kept: true })));
  };

  const handleDiscardAll = () => {
    setResults(prev => prev.map(q => ({ ...q, kept: false })));
  };

  const handleCommitDrafts = async () => {
    const keptQuestions = results.filter(q => q.kept);
    if (keptQuestions.length === 0) {
      toast({ title: "Error", description: "No questions selected to commit", variant: "destructive" });
      return;
    }

    try {
      // Convert to draft format and save
      const drafts = keptQuestions.map(q => ({
        stem: q.stem,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        exam,
        topic: topic && topic !== "all" ? topic : null,
        subtopic: subtopic || null,
        difficulty,
        tags: ["EM", exam, topic && topic !== "all" ? topic : null].filter(Boolean),
        status: "draft"
      }));

      await callFunction('/save-question-drafts', { drafts });
      
      toast({ 
        title: "Success", 
        description: `Committed ${keptQuestions.length} drafts for review` 
      });
      
      // Remove committed questions from results
      setResults(prev => prev.filter(q => !q.kept));
    } catch (error: any) {
      toast({ 
        title: "Commit Failed", 
        description: error.message || "Failed to save drafts", 
        variant: "destructive" 
      });
    }
  };

  const keptCount = results.filter(q => q.kept).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Generator</h1>
              <p className="text-sm text-muted-foreground">Create draft MCQs for review</p>
            </div>
            {keptCount > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleKeepAll}>
                  Keep All
                </Button>
                <Button variant="outline" onClick={handleDiscardAll}>
                  Discard All
                </Button>
                <Button onClick={handleCommitDrafts}>
                  Commit {keptCount} Drafts
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Configure */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Configure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Exam Selection */}
                <div>
                  <Label>Exam Type *</Label>
                  <Select value={exam} onValueChange={(value) => {
                    setExam(value as ExamName);
                    setTopic("all");
                    setSubtopic("");
                  }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAMS.map((examType) => (
                        <SelectItem key={examType} value={examType}>
                          {examType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic Selection */}
                {exam && (
                  <div>
                    <Label>Topic</Label>
                    <Select value={topic} onValueChange={setTopic}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All topics" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All topics</SelectItem>
                        {CURRICULA[exam]?.map((topicName) => (
                          <SelectItem key={topicName} value={topicName}>
                            {topicName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Subtopic */}
                <div>
                  <Label>Subtopic</Label>
                  <Input
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="Optional specific focus"
                    className="mt-1"
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((diff) => (
                        <SelectItem key={diff.value} value={diff.value}>
                          {diff.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Count */}
                <div>
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>

                {/* Knowledge Sources */}
                <div>
                  <Label>Knowledge Sources</Label>
                  <div className="mt-2 space-y-2">
                    {KNOWLEDGE_SOURCES.map((source) => (
                      <div key={source.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={source.id}
                          checked={knowledgeSources.includes(source.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setKnowledgeSources(prev => [...prev, source.id]);
                            } else {
                              setKnowledgeSources(prev => prev.filter(id => id !== source.id));
                            }
                          }}
                        />
                        <Label htmlFor={source.id} className="text-sm">
                          {source.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Temperature Toggle */}
                <div className="flex items-center justify-between">
                  <Label>Custom Temperature</Label>
                  <Switch
                    checked={useTemperature}
                    onCheckedChange={setUseTemperature}
                  />
                </div>
                
                {useTemperature && (
                  <div>
                    <Label>Temperature ({temperature})</Label>
                    <Input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Cost Estimate */}
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm font-medium">Cost Estimate</div>
                  <div className="text-lg font-bold">${costEstimate.toFixed(2)}</div>
                </div>

                {/* Generate Button */}
                <Button 
                  onClick={handleGenerate}
                  disabled={!exam || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Panel - Results */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Results</CardTitle>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Configure options and click Generate.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {results.map((question, index) => (
                      <Card key={question.id} className={`border-2 ${question.kept ? 'border-green-600' : 'border-border'}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <Badge variant="outline">Q{index + 1}</Badge>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={question.kept ? "default" : "outline"}
                                onClick={() => handleKeep(question.id)}
                              >
                                {question.kept ? <CheckCircle2 className="w-4 h-4" /> : "Keep"}
                              </Button>
                              <Button size="sm" variant="outline">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="font-medium mb-2">Stem</div>
                              <p className="text-sm">{question.stem}</p>
                            </div>

                            <div>
                              <div className="font-medium mb-2">Options</div>
                              <div className="space-y-1">
                                {question.options.map((option, optIndex) => (
                                  <div 
                                    key={optIndex}
                                     className={`text-sm p-2 rounded ${
                                       optIndex === question.correct_index 
                                         ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                                         : 'bg-muted'
                                     }`}
                                  >
                                    <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span> {option}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="font-medium mb-2">Explanation</div>
                              <p className="text-sm text-muted-foreground">{question.explanation}</p>
                            </div>

                            {question.reference && (
                              <div>
                                <div className="font-medium mb-2">Reference</div>
                                <p className="text-sm text-muted-foreground">{question.reference}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Drawer - Prompt & Context */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Prompt & Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Prompt Template</Label>
                  <Textarea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    rows={8}
                    className="mt-1 text-xs"
                  />
                </div>

                <Separator />

                <div>
                  <Label>Injected Variables</Label>
                  <div className="mt-2 space-y-1 text-xs">
                    <div><span className="font-mono">exam:</span> {exam || "Not selected"}</div>
                    <div><span className="font-mono">topic:</span> {topic && topic !== "all" ? topic : "All"}</div>
                    <div><span className="font-mono">difficulty:</span> {difficulty}</div>
                    <div><span className="font-mono">count:</span> {count}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Context Snippets</Label>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {knowledgeSources.length > 0 ? (
                      <div>
                        Using: {knowledgeSources.map(id => 
                          KNOWLEDGE_SOURCES.find(s => s.id === id)?.label
                        ).join(", ")}
                      </div>
                    ) : (
                      "No knowledge sources selected"
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}