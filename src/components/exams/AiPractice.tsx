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

interface AIQuestion {
  id: string;
  question: string;
  options: string[]; // ['A. ...','B. ...','C. ...','D. ...']
  correct_answer: string; // 'A' | 'B' | 'C' | 'D'
  explanation?: string;
  source?: string;
}

type Feedback = "none" | "too_easy" | "hallucinated" | "wrong" | "not_relevant";

const EXAMS = [
  "MRCEM Primary",
  "MRCEM Intermediate SBA",
  "FRCEM Final"
];
const COUNTS = [10, 25, 50];

export default function AiPractice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exam, setExam] = useState<string>(EXAMS[0]);
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
        body: { action: "generate_question", session_id: s, topic: topic || undefined }
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
                  {EXAMS.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
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
              <Label>Focus area (optional)</Label>
              <Input className="mt-1" placeholder="e.g., Cardiology" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Badge variant="secondary">Signed in</Badge>
            ) : (
              <Badge variant="outline">Guest • Free left: {remainingFree}</Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled={!sessionId} onClick={() => generateQuestion()}>Skip</Button>
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
