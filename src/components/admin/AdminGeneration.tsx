import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EXAMS, CURRICULA, ExamName } from "@/lib/curricula";

export default function AdminGeneration() {
  const { toast } = useToast();
  const [exam, setExam] = useState<ExamName | "">("");
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [count, setCount] = useState<number>(5);
  const [reviewerId, setReviewerId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gurus, setGurus] = useState<Array<{ id: string; name: string }>>([]);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    // Load available gurus for assignment
    const loadGurus = async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id, profiles!inner(full_name)')
          .eq('role', 'guru');
        const guruList = (data || []).map((r: any) => ({
          id: r.user_id,
          name: r.profiles?.full_name || 'Unknown'
        }));
        setGurus(guruList);
      } catch (e) {
        console.error('Failed to load gurus:', e);
      }
    };
    loadGurus();
  }, []);

  const generateQuestions = async () => {
    if (!exam) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('ai-exams-api', {
        body: {
          action: 'bulk_generate',
          exam_type: exam,
          topic: topic || undefined,
          difficulty,
          count,
          persistAsDraft: true,
          reviewer_assign_to: reviewerId || undefined
        }
      });

      if (res.error) throw res.error;
      
      const { items, count: generated } = res.data || {};
      toast({
        title: 'Questions generated',
        description: `Successfully generated ${generated} out of ${count} questions${reviewerId ? ' and assigned for review' : ''}.`
      });

      // Reset form
      setExam("");
      setTopic("");
      setCount(5);
      setReviewerId("");
    } catch (err: any) {
      console.error('Generate failed', err);
      const errorMsg = err?.message || String(err);
      toast({
        title: 'Generation failed',
        description: errorMsg.includes('OpenAI') ? 'AI service not configured. Please contact support.' : errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testGeneration = async () => {
    if (!exam) return;
    setLoading(true);
    setTestResult(null);
    try {
      const res = await supabase.functions.invoke('ai-exams-api', {
        body: {
          action: 'bulk_generate',
          exam_type: exam,
          topic: topic || undefined,
          difficulty,
          count: 1,
          persistAsDraft: false
        }
      });

      if (res.error) throw res.error;
      
      const { items } = res.data || {};
      if (items?.[0]) {
        setTestResult(items[0]);
        toast({ title: 'Test successful', description: 'AI generation is working properly.' });
      } else {
        throw new Error('No question generated');
      }
    } catch (err: any) {
      console.error('Test failed', err);
      const errorMsg = err?.message || String(err);
      toast({
        title: 'Test failed',
        description: errorMsg.includes('OpenAI') ? 'AI service not configured. Please contact support.' : errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const topics = exam && CURRICULA[exam] ? CURRICULA[exam] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Exam</Label>
              <Select value={exam} onValueChange={(v) => setExam(v as ExamName)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {EXAMS.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Topic (optional)</Label>
              <Select value={topic} onValueChange={setTopic} disabled={!exam}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All topics</SelectItem>
                  {topics.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Count (1-20)</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Assign to Reviewer (optional)</Label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No assignment</SelectItem>
                  {gurus.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button 
              onClick={testGeneration} 
              disabled={!exam || loading}
              variant="outline"
              size="sm"
            >
              {loading ? 'Testing...' : 'Test'}
            </Button>
            <Button 
              onClick={generateQuestions} 
              disabled={!exam || loading}
            >
              {loading ? 'Generating...' : 'Generate & Queue'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Question:</strong> {testResult.question}</div>
              <div><strong>Options:</strong></div>
              <ul className="list-disc list-inside ml-4">
                {Object.entries(testResult.options || {}).map(([key, value]) => (
                  <li key={key}><strong>{key}:</strong> {String(value)}</li>
                ))}
              </ul>
              <div><strong>Correct:</strong> {testResult.correct}</div>
              <div><strong>Explanation:</strong> {testResult.explanation}</div>
              {testResult.reference && <div><strong>Reference:</strong> {testResult.reference}</div>}
              {testResult.topic && <div><strong>Topic:</strong> {testResult.topic}</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}