import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import { getJson } from "@/lib/functionsClient";

// Map human names to backend enum codes
const EXAM_CODE_MAP: Record<ExamName, string> = {
  "MRCEM Primary": "MRCEM_Primary",
  "MRCEM Intermediate SBA": "MRCEM_SBA",
  "FRCEM SBA": "FRCEM_SBA",
};

export default function PracticeConfig() {
  useEffect(() => {
    document.title = "Practice Mode • EM Gurus";
    const desc = "Configure Practice Mode with curated questions from expert reviewers.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamName | "">("");
  const [topic, setTopic] = useState<string>("All areas");
  const [loading, setLoading] = useState(false);

  // Available topics based on reviewed questions
  const [availableTopics, setAvailableTopics] = useState<string[]>(["All areas"]);
  const [availableExams, setAvailableExams] = useState<ExamName[]>([...EXAMS]);

  // Load available exams
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('reviewed_exam_questions')
          .select('exam')
          .eq('status', 'approved')
          .not('exam', 'is', null);
        
        const codes = Array.from(new Set(data?.map(r => r.exam).filter(Boolean) || []));
        const names = EXAMS.filter(name => codes.includes(EXAM_CODE_MAP[name] || name));
        setAvailableExams(names.length ? names : [...EXAMS]);
      } catch {
        setAvailableExams([...EXAMS]);
      }
    })();
  }, []);

  // Load available topics when exam changes
  useEffect(() => {
    (async () => {
      if (!exam) {
        setAvailableTopics(["All areas"]);
        return;
      }

      try {
        const examCode = EXAM_CODE_MAP[exam] || exam;
        const { data } = await supabase
          .from('reviewed_exam_questions')
          .select('topic')
          .eq('status', 'approved')
          .eq('exam', examCode)
          .not('topic', 'is', null);

        const topics = Array.from(new Set(data?.map(r => r.topic).filter(Boolean) || []));
        const allowed = CURRICULA[exam] ? topics.filter(t => CURRICULA[exam].includes(t)) : topics;
        setAvailableTopics(['All areas', ...allowed]);
      } catch {
        setAvailableTopics(['All areas']);
      }
    })();
  }, [exam]);

  // Reset topic if it becomes unavailable
  useEffect(() => {
    if (!availableTopics.includes(topic)) {
      setTopic('All areas');
    }
  }, [availableTopics, topic]);

  const fetchReviewedIds = async (examName: ExamName, topicName: string) => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    const examCode = EXAM_CODE_MAP[examName] || examName;
    params.set('exam', examCode);
    if (topicName !== 'All areas') params.set('q', topicName);

    try {
      const res = await getJson(`/public-reviewed-exams?${params.toString()}`);
      const items = Array.isArray(res.items) ? res.items : [];
      const ids = items.map((r: any) => r.id).filter(Boolean);
      if (ids.length) return ids;
    } catch {}

    // Fallback to direct query
    let query = supabase
      .from('reviewed_exam_questions')
      .select('id')
      .eq('status', 'approved')
      .eq('exam', examCode)
      .order('reviewed_at', { ascending: false })
      .limit(50);

    if (topicName !== 'All areas') {
      query = query.eq('topic', topicName);
    }

    const { data } = await query;
    return data?.map(r => r.id).filter(Boolean) || [];
  };

  const start = async () => {
    if (!exam) return;
    
    // Check auth first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(`/auth?returnTo=${encodeURIComponent('/exams/practice')}`);
      return;
    }
    
    setLoading(true);
    try {
      const ids = await fetchReviewedIds(exam, topic);
      if (!ids.length) {
        toast({
          title: "No questions available",
          description: "No questions match your selected criteria.",
          variant: "destructive"
        });
        return;
      }

      // Shuffle the IDs for randomization
      const shuffledIds = [...ids].sort(() => Math.random() - 0.5);
      navigate(`/exams/practice/session/${shuffledIds[0]}`, { 
        state: { ids: shuffledIds, index: 0 } 
      });
    } catch (err: any) {
      console.error('Start failed', err);
      toast({ 
        title: "Start failed", 
        description: err?.message || String(err),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Practice Mode</h1>
            <p className="text-sm text-muted-foreground">Curated questions from expert reviewers</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/exams')}>
            Back to Exams
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Practice Configuration
            <Badge variant="secondary">Untimed</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Exam <span className="text-destructive">*</span></Label>
            <Select value={exam} onValueChange={(v) => setExam(v as ExamName)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {availableExams.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Topic</Label>
            <Select value={topic} onValueChange={setTopic} disabled={!exam}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="All areas" />
              </SelectTrigger>
              <SelectContent>
                {availableTopics.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <strong>Practice Mode Features:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Immediate feedback after each question</li>
                  <li>• Expert-reviewed questions only</li>
                  <li>• Detailed explanations included</li>
                  <li>• Navigate freely between questions</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-2 justify-end pt-2">
            <Button onClick={start} disabled={!exam || loading} size="lg">
              {loading ? 'Loading questions...' : 'Start Practice'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}