import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";
import { getJson } from "@/lib/functionsClient";
import { useRoles } from "@/hooks/useRoles";

// Map human names to backend enum codes
const EXAM_CODE_MAP: Record<ExamName, string> = {
  "MRCEM Primary": "MRCEM_Primary",
  "MRCEM Intermediate SBA": "MRCEM_SBA",
  "FRCEM SBA": "FRCEM_SBA",
  "FCPS Part 1 – Pakistan": "FCPS_PART1",
  "FCPS IMM – Pakistan": "FCPS_IMM",
  "FCPS Part 2 – Pakistan": "FCPS_PART2",
  "Other": "OTHER",
};

const TIME_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

export default function ExamConfig() {
  useEffect(() => {
    document.title = "Exam Mode • EM Gurus";
    const desc = "Configure timed Exam Mode with realistic exam conditions.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isGuru } = useRoles();
  const [exam, setExam] = useState<ExamName | "">("");
  const [topic, setTopic] = useState<string>("All areas");
  const [count, setCount] = useState<number>(25);
  const [timeLimit, setTimeLimit] = useState<string>("60");
  const [loading, setLoading] = useState(false);

  // Available topics based on reviewed questions
  const [availableTopics, setAvailableTopics] = useState<string[]>(["All areas"]);
  const [availableExams, setAvailableExams] = useState<ExamName[]>([...EXAMS]);
  
  // Subscription check
  const [isPaid, setIsPaid] = useState(false);
  const maxQuestions = isPaid ? 100 : 25;

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsPaid(false); return; }
        const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('user_id', user.id).maybeSingle();
        const tier = String(prof?.subscription_tier || 'free').toLowerCase();
        setIsPaid(tier.includes('exams') || tier.includes('premium') || isAdmin || isGuru);
      } catch { setIsPaid(false); }
    })();
  }, [isAdmin, isGuru]);

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

  const fetchReviewedIds = async (examName: ExamName, topicName: string, limit: number) => {
    const params = new URLSearchParams();
    params.set('limit', String(Math.max(1, Math.min(100, limit))));
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
      .limit(Math.max(1, Math.min(100, limit)));

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
      navigate(`/auth?returnTo=${encodeURIComponent('/exams/exam')}`);
      return;
    }
    
    setLoading(true);
    try {
      const finalCount = Math.max(5, Math.min(maxQuestions, count));
      const ids = await fetchReviewedIds(exam, topic, finalCount);
      
      if (!ids.length) {
        toast({
          title: "No questions available",
          description: "No questions match your selected criteria.",
          variant: "destructive"
        });
        return;
      }

      // Shuffle the IDs for randomization
      const shuffledIds = [...ids].sort(() => Math.random() - 0.5).slice(0, finalCount);
      const limitSec = Number(timeLimit) * 60;
      
      // Prepare session state with proper data structure
      const sessionState = {
        ids: shuffledIds,
        limitSec,
        exam,
        topic: topic === 'All areas' ? undefined : topic,
        count: finalCount
      };
      
      console.log('Starting exam session with:', sessionState);
      
      navigate('/exams/exam/session', { 
        state: sessionState
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 mx-0 w-full px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Exam Mode
            </h1>
            <p className="text-sm text-muted-foreground">Timed practice with realistic exam conditions</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/exams')}>
            Back to Exams
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Exam Configuration
            <Badge variant="destructive">Timed</Badge>
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

          <div>
            <Label>Number of Questions</Label>
            <Input
              type="number"
              min="5"
              max={maxQuestions}
              value={count}
              onChange={(e) => setCount(Math.max(5, Math.min(maxQuestions, Number(e.target.value) || 25)))}
              className="mt-1"
            />
            {!isPaid && (
              <p className="text-xs text-muted-foreground mt-1">
                Free tier limited to 25 questions. <a href="/pricing" className="text-primary hover:underline">Upgrade</a> for more.
              </p>
            )}
          </div>

          <div>
            <Label>Time Limit</Label>
            <Select value={timeLimit} onValueChange={setTimeLimit}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <strong>Exam Mode Features:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Timed examination environment</li>
                  <li>• Questions are locked after submission</li>
                  <li>• Final score and analysis at completion</li>
                  <li>• Mark questions for review</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-2 justify-end pt-2">
            <Button onClick={start} disabled={!exam || loading} size="lg">
              {loading ? 'Loading questions...' : 'Start Exam'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}