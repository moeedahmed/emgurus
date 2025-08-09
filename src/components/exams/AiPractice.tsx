import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import QuestionCard from "./QuestionCard";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
interface AIQuestion {
  id: string;
  question: string;
  options: string[]; // ['A. ...','B. ...','C. ...','D. ...']
  correct_answer: string; // 'A' | 'B' | 'C' | 'D'
  explanation?: string;
  source?: string;
}

interface CurriculumRow {
  id: string;
  slo_number: number;
  slo_title: string;
  key_capability_number: number;
  key_capability_title: string;
}

type Feedback = "none" | "too_easy" | "hallucinated" | "wrong" | "not_relevant";

const EXAMS = [
  { value: "MRCEM_PRIMARY", label: "MRCEM Primary" },
  { value: "MRCEM_SBA", label: "MRCEM Intermediate SBA" },
  { value: "FRCEM_SBA", label: "FRCEM SBA" },
];
const COUNTS = [10, 25, 50];

export default function AiPractice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exam, setExam] = useState<string>(EXAMS[0].value);
  const [count, setCount] = useState<number>(10);
  const [topic, setTopic] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<AIQuestion | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Feedback>("none");
  const pendingReportRef = useRef<Feedback>("none");
  const [curriculumRows, setCurriculumRows] = useState<CurriculumRow[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState<string[]>([]);

  const remainingFree = useMemo(() => {
    if (user) return Infinity; // extend later with subscription
    const used = Number(localStorage.getItem("free_ai_used") || "0");
    return Math.max(0, 10 - used);
  }, [user]);

  useEffect(() => {
    // Try resume if same user
    const saved = localStorage.getItem("ai_practice_session");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if ((user && data.user_id === user.id) || (!user && !data.user_id)) {
        setSessionId(data.session_id);
        setExam(data.examType);
        setIndex(data.index || 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("curriculum_map")
        .select("id, slo_number, slo_title, key_capability_number, key_capability_title")
        .eq("exam_type", exam as any)
        .order("slo_number", { ascending: true })
        .order("key_capability_number", { ascending: true });
      setCurriculumRows((data as any) || []);
      // reset selection when exam changes
      setSelectedCurriculum([]);
    };
    load();
  }, [exam]);

  const groupedCurriculum = useMemo(() => {
    const m = new Map<number, { title: string; items: CurriculumRow[] }>();
    for (const r of curriculumRows) {
      const g = m.get(r.slo_number) || { title: r.slo_title, items: [] };
      g.items.push(r);
      m.set(r.slo_number, g);
    }
    return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]);
  }, [curriculumRows]);

  const persistSession = (sid: string, idx: number) => {
    localStorage.setItem("ai_practice_session", JSON.stringify({ session_id: sid, examType: exam, index: idx, user_id: user?.id || null }));
  };

  const startSession = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to use AI Practice." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-exams-api", {
        body: { action: "start_session", examType: exam }
      });
      if (error) throw error;
      const sid = data.session.id as string;
      setSessionId(sid);
      setIndex(0);
      setSelected("");
      setShowExplanation(false);
      setIsCorrect(null);
      persistSession(sid, 0);
      await generateQuestion(sid);
    } catch (e: any) {
      toast({ title: "Error starting session", description: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async (sid?: string) => {
    const s = sid || sessionId;
    if (!s) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-exams-api", {
        body: { action: "generate_question", session_id: s, curriculum_ids: selectedCurriculum.length ? selectedCurriculum : undefined }
      });
      if (error) throw error;
      setQuestion(data.question as AIQuestion);
      setSelected("");
      setShowExplanation(false);
      setIsCorrect(null);
    } catch (e: any) {
      toast({ title: "Error generating question", description: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!question || !selected) {
      toast({ title: "Select an answer", description: "Please choose an option to submit." });
      return;
    }
    if (!sessionId) return;
    if (!user) return; // guarded above
    // Free limit for guests is already blocked; for logged-in not enforced yet
    setLoading(true);
    try {
      const fb = pendingReportRef.current || feedback;
      const { data, error } = await supabase.functions.invoke("ai-exams-api", {
        body: { action: "submit_answer", question_id: question.id, selected_answer: selected, feedback: fb }
      });
      if (error) throw error;
      const ok = Boolean(data.result?.is_correct);
      setIsCorrect(ok);
      setShowExplanation(true);
      // Count usage for guests
      if (!user) {
        const used = Number(localStorage.getItem("free_ai_used") || "0");
        localStorage.setItem("free_ai_used", String(used + 1));
      }
    } catch (e: any) {
      toast({ title: "Error submitting", description: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    if (!sessionId) return;
    const nextIdx = index + 1;
    setIndex(nextIdx);
    persistSession(sessionId, nextIdx);
    if (nextIdx >= count) {
      toast({ title: "Session complete", description: "You've completed this practice set." });
      return;
    }
    await generateQuestion();
  };

  const canStart = !!exam && !!count;
  const blockedByFreeLimit = !user && remainingFree <= 0;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure AI Practice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Exam</Label>
              <Select value={exam} onValueChange={setExam}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {EXAMS.map((e) => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Number of questions</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select count" /></SelectTrigger>
                <SelectContent>
                  {COUNTS.map((c) => (<SelectItem key={c} value={String(c)}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Curriculum Area</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="mt-1 w-full justify-between">
                    {selectedCurriculum.length ? `${selectedCurriculum.length} selected` : "All areas"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Select Curriculum Area</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-auto space-y-4">
                    {groupedCurriculum.map(([slo, group]) => (
                      <div key={slo} className="space-y-2">
                        <div className="font-medium">SLO {slo}: {group.title}</div>
                        <div className="grid gap-2">
                          {group.items.map((item) => (
                            <label key={item.id} className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedCurriculum.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedCurriculum((prev) => (checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)));
                                }}
                              />
                              <span>{item.key_capability_title}</span>
                            </label>
                          ))}
                        </div>
                        <Separator />
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setSelectedCurriculum([])}>Clear</Button>
                    <Button type="button">Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Badge variant="secondary">Signed in</Badge>
            ) : (
              <Badge variant="outline">Guest • Free left: {remainingFree}</Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => { if (!sessionId) startSession(); else generateQuestion(); }}>Skip</Button>
              <Button disabled={!canStart || loading || blockedByFreeLimit} onClick={startSession}>
                {blockedByFreeLimit ? "Upgrade to continue" : (sessionId ? "Restart" : "Generate")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {blockedByFreeLimit && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="text-sm">You've reached the free AI limit. Upgrade to unlock full access.</div>
            <a href="/#pricing"><Button variant="hero">View Plans</Button></a>
          </CardContent>
        </Card>
      )}

      {sessionId && question && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Question {index + 1} of {count}</span>
              {isCorrect !== null && (
                <Badge variant={isCorrect ? "default" : "destructive"}>{isCorrect ? "Correct" : "Incorrect"}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <QuestionCard
              stem={question.question}
              options={question.options.map((opt: string) => ({ key: opt.slice(0,1), text: opt.substring(3) }))}
              selectedKey={selected}
              onSelect={setSelected}
              showExplanation={showExplanation}
              explanation={question.explanation}
              source={question.source}
            />

            <div className="flex items-center gap-3">
              <ReportChooser onChange={(v) => { pendingReportRef.current = v; setFeedback(v); }} />
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={() => generateQuestion()} disabled={loading}>Skip</Button>
                {!showExplanation ? (
                  <Button onClick={submit} disabled={!selected || loading}>Submit</Button>
                ) : (
                  <Button onClick={next} disabled={loading}>Next</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportChooser({ onChange }: { onChange: (v: Feedback) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Feedback>("none");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this question</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {([
            { k: "none", l: "No issue" },
            { k: "too_easy", l: "Too Easy" },
            { k: "not_relevant", l: "Irrelevant" },
            { k: "wrong", l: "Inaccurate / Wrong" },
            { k: "hallucinated", l: "Hallucinated" },
          ] as Array<{k: Feedback; l: string}>).map((o) => (
            <label key={o.k} className="flex items-center gap-3">
              <input
                type="radio"
                name="feedback"
                className="accent-[hsl(var(--primary))]"
                checked={value === o.k}
                onChange={() => setValue(o.k)}
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onChange(value); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
