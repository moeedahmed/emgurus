import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EXAMS, CURRICULA, ExamName } from "@/lib/curricula";
import { getJson } from "@/lib/functionsClient";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";

// Map human names to backend enum codes
const EXAM_CODE_MAP_LANDING: Record<ExamName, string> = {
  "MRCEM Primary": "MRCEM_Primary",
  "MRCEM Intermediate SBA": "MRCEM_SBA",
  "FRCEM SBA": "FRCEM_SBA",
};

const buildExamVariants = (exam: string): string[] => {
  const set = new Set<string>();
  set.add(exam);
  set.add(exam.replace(/\s+/g, "_"));
  set.add(exam.replace(/\s+/g, "_").toUpperCase());
  set.add(exam.toUpperCase());
  const mapped = (EXAM_CODE_MAP_LANDING as any)[exam];
  if (mapped) { set.add(mapped); set.add(String(mapped).toUpperCase()); }
  return Array.from(set).filter(Boolean);
};


export default function Exams() {
  const navigate = useNavigate();
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  // Modal feature flags for potential rollback
  const USE_EXAM_PRACTICE_MODALS = false;

  const [pExam, setPExam] = useState<ExamName | "">("");
  const [pTopic, setPTopic] = useState<string>("All areas");

  const [eExam, setEExam] = useState<ExamName | "">("");
  const [eTopic, setETopic] = useState<string>("All areas");
  const [eCount, setECount] = useState<number>(25);
  const [eTimed, setETimed] = useState<boolean>(true);
const { isAdmin, isGuru } = useRoles();
const [isPaid, setIsPaid] = useState(false);
const maxExam = isPaid ? 100 : 25;
const maxAi = isPaid ? 100 : 10;
// Practice topic availability
const [pAreasAvail, setPAreasAvail] = useState<string[]>(["All areas"]);
const [pHasAny, setPHasAny] = useState<boolean>(false);
// Exam topic availability (mirrors practice)
const [eAreasAvail, setEAreasAvail] = useState<string[]>(["All areas"]);
const [eHasAny, setEHasAny] = useState<boolean>(false);
// Available exams that actually have reviewed questions
const [availExams, setAvailExams] = useState<ExamName[]>([...EXAMS] as ExamName[]);
// Exam time selection
const [eTime, setETime] = useState<string>("60");

// Prefill from query params (practice only)
useEffect(() => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const mode = sp.get('mode');
    const qpExam = sp.get('exam');
    const qpTopic = sp.get('topic');
    // reverse map for codes
    const CODE_TO_NAME: Record<string, ExamName> = {
      MRCEM_Primary: 'MRCEM Primary',
      MRCEM_SBA: 'MRCEM Intermediate SBA',
      FRCEM_SBA: 'FRCEM SBA',
    };
    const normalizeExam = (val?: string | null): ExamName | "" => {
      if (!val) return "";
      const decoded = decodeURIComponent(val);
      if ((EXAMS as readonly ExamName[]).includes(decoded as ExamName)) return decoded as ExamName;
      const byCode = CODE_TO_NAME[decoded];
      return byCode || "";
    };
    if (mode === 'practice') {
      const name = normalizeExam(qpExam);
      if (name) setPExam(name);
      if (qpTopic) setPTopic(decodeURIComponent(qpTopic));
    }
  } catch {}
}, []);

  useEffect(() => {
    document.title = "EMGurus Exam Practice • EM Gurus";
    const desc = "Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsPaid(false); return; }
        const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('user_id', user.id).maybeSingle();
        const tier = String((prof as any)?.subscription_tier || 'free').toLowerCase();
        setIsPaid(tier.includes('exams') || tier.includes('premium'));
      } catch { setIsPaid(false); }
    })();
  }, []);

  // Load available exams based on reviewed bank
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('exam')
          .eq('status', 'approved')
          .not('exam', 'is', null)
          .limit(2000);
        const codes = Array.from(new Set((Array.isArray(data) ? data : []).map((r: any) => r.exam).filter(Boolean)));
        const names = [...EXAMS].filter((name) => codes.includes((EXAM_CODE_MAP_LANDING as any)[name] || (name as any)));
        setAvailExams(names.length ? names : [...EXAMS]);
      } catch { setAvailExams([...EXAMS]); }
    })();
  }, []);

  // Load available topics for Practice based on reviewed bank
  useEffect(() => {
    (async () => {
      if (!practiceOpen || !pExam) { setPAreasAvail(["All areas"]); setPHasAny(false); return; }
      try {
        const examCode = (EXAM_CODE_MAP_LANDING as any)[pExam] || pExam;
        const { data } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('topic')
          .eq('status', 'approved')
          .eq('exam', examCode)
          .not('topic', 'is', null)
          .order('topic', { ascending: true })
          .limit(1000);
        const topics = Array.from(new Set((Array.isArray(data) ? data : []).map((r: any) => r.topic).filter(Boolean)));
        const allowed = CURRICULA[pExam] ? topics.filter(t => (CURRICULA as any)[pExam].includes(t)) : topics;
        setPAreasAvail(['All areas', ...allowed]);
        setPHasAny(((data || []).length) > 0);
      } catch {
        setPAreasAvail(['All areas']);
        setPHasAny(false);
      }
    })();
  }, [practiceOpen, pExam]);

  // Load available topics for Exam based on reviewed bank
  useEffect(() => {
    (async () => {
      if (!examOpen || !eExam) { setEAreasAvail(["All areas"]); setEHasAny(false); return; }
      try {
        const examCode = (EXAM_CODE_MAP_LANDING as any)[eExam] || eExam;
        const { data } = await (supabase as any)
          .from('reviewed_exam_questions')
          .select('topic')
          .eq('status', 'approved')
          .eq('exam', examCode)
          .not('topic', 'is', null)
          .order('topic', { ascending: true })
          .limit(1000);
        const topics = Array.from(new Set((Array.isArray(data) ? data : []).map((r: any) => r.topic).filter(Boolean)));
        const allowed = CURRICULA[eExam] ? topics.filter(t => (CURRICULA as any)[eExam].includes(t)) : topics;
        setEAreasAvail(['All areas', ...allowed]);
        setEHasAny(((data || []).length) > 0);
      } catch {
        setEAreasAvail(['All areas']);
        setEHasAny(false);
      }
    })();
  }, [examOpen, eExam]);

  useEffect(() => {
    if (!pAreasAvail.includes(pTopic)) setPTopic('All areas');
  }, [pAreasAvail]);

  // Fetch reviewed question IDs via Edge Function, with direct-table fallback
  const fetchReviewedIds = async (exam?: ExamName | "", topic?: string, limit: number = 50) => {
    const params = new URLSearchParams();
    params.set('limit', String(Math.max(1, Math.min(100, limit))));
    const examParam = exam ? (EXAM_CODE_MAP_LANDING[exam] || exam) : "";
    if (examParam) params.set('exam', String(examParam));
    if (topic && topic !== 'All areas') params.set('q', topic);
    try {
      const res = await getJson(`/public-reviewed-exams?${params.toString()}`);
      const items = Array.isArray(res.items) ? res.items : [];
      const ids = items.map((r: any) => r.id).filter(Boolean);
      if (ids.length) return ids;
      // If edge returns empty, fall through to direct query for robustness
    } catch {}

    // Fallback to direct table query
    let q = (supabase as any)
      .from('reviewed_exam_questions')
      .select('id', { count: 'exact' })
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));

    if (exam) {
      const examCode = EXAM_CODE_MAP_LANDING[exam as ExamName] || exam;
      q = q.eq('exam', examCode);
    }
    if (topic && topic !== 'All areas') {
      q = q.eq('topic', topic);
    }
    const { data } = await q;
    return (Array.isArray(data) ? data : []).map((r: any) => r.id).filter(Boolean);
  };
  const startPractice = async () => {
    try {
      const ids = await fetchReviewedIds(pExam, pTopic, 50);
      if (!ids.length) { setPracticeOpen(false); return; }
      navigate(`/exams/practice/${ids[0]}`, { state: { ids, index: 0 } });
    } finally {
      setPracticeOpen(false);
    }
  };

  const startExam = async () => {
    try {
      const ids = await fetchReviewedIds(eExam, eTopic, Math.max(5, Math.min(maxExam, eCount)));
      if (!ids.length) { setExamOpen(false); return; }
      const limitSec = Number(eTime) * 60;
      navigate('/exams/exam', { state: { ids, limitSec } });
    } finally {
      setExamOpen(false);
    }
  };

  const pAreas = pAreasAvail;
  const eAreas = eAreasAvail;

  return (
    <main>
      {/* Canonical tag for SEO */}
      <link rel="canonical" href={typeof window !== 'undefined' ? window.location.origin + '/exams' : '/exams'} />
      <PageHero title="EMGurus Exam Practice" subtitle="Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher." align="center" ctas={[{ label: "Exam Membership", href: "/pricing", variant: "outline" }]} />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-3">
          {/* AI Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">AI Mode <span className="ml-2 align-middle text-xs px-2 py-0.5 rounded-full border">Beta</span></h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• AI-generated questions on demand</li>
                <li>• Instant explanations and feedback</li>
                <li>• Customizable by exam and topic</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button size="lg" aria-label="Start AI Mode" onClick={() => navigate('/exams/ai-practice')}>
                Start AI Mode
              </Button>
            </div>
          </Card>

          {/* Practice Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Practice Mode</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Curated questions from expert reviewers</li>
                <li>• See answers and explanations immediately</li>
                <li>• Untimed learning experience</li>
              </ul>
            </div>
            <div className="pt-6">
              {USE_EXAM_PRACTICE_MODALS ? (
                <Dialog open={practiceOpen} onOpenChange={setPracticeOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" aria-label="Start Practice">Start Practice</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start Practice</DialogTitle>
                      <DialogDescription className="sr-only">Select an exam and topic to start practice mode.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Exam</Label>
                        <Select value={pExam || undefined as any} onValueChange={(v) => setPExam(v as ExamName)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                          <SelectContent className="z-50">
                            {availExams.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Topic</Label>
                        <Select value={pTopic} onValueChange={setPTopic} disabled={!pExam}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
                          <SelectContent className="z-50">
                            {pAreas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setPracticeOpen(false)}>Cancel</Button>
                        <Button onClick={startPractice} disabled={!pExam || !pHasAny}>Start</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button size="lg" aria-label="Start Practice Mode" onClick={() => navigate('/exams/practice')}>
                  Start Practice Mode
                </Button>
              )}
            </div>
          </Card>

          {/* Exam Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Test Mode</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Timed practice tests</li>
                <li>• Realistic test conditions</li>
                <li>• Complete score analysis</li>
              </ul>
            </div>
            <div className="pt-6">
              {USE_EXAM_PRACTICE_MODALS ? (
                <Dialog open={examOpen} onOpenChange={setExamOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" aria-label="Start Test">Start Test</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start Test</DialogTitle>
                      <DialogDescription className="sr-only">Select exam and topic, then set number and time to begin a timed test.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-1">
                        <Label>Exam</Label>
                        <Select value={eExam || undefined as any} onValueChange={(v) => setEExam(v as ExamName)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                          <SelectContent className="z-50">
                            {availExams.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-1">
                        <Label>Topic</Label>
                        <Select value={eTopic} onValueChange={setETopic} disabled={!eExam}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="All areas" /></SelectTrigger>
                          <SelectContent className="z-50">
                            {eAreas.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-1">
                        <Label>Number</Label>
                        <Input type="number" min={5} max={maxExam} value={eCount} onChange={(e)=> {
                          const v = Number(e.target.value || 25);
                          setECount(Math.max(5, Math.min(maxExam, v)));
                        }} className="mt-1" />
                      </div>
                      <div className="md:col-span-1">
                        <Label>Time</Label>
                        <Select value={eTime} onValueChange={setETime}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select time" /></SelectTrigger>
                          <SelectContent className="z-50">
                            {[30,45,60,90,120].map(m => (<SelectItem key={m} value={String(m)}>{m} min</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3 flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setExamOpen(false)}>Cancel</Button>
                        <Button onClick={startExam} disabled={!eExam || !eHasAny}>Start</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button size="lg" aria-label="Start Test Mode" onClick={() => navigate('/exams/test')}>
                  Start Test Mode
                </Button>
              )}
            </div>
          </Card>
        </div>
      </section>

    </main>
  );
}

