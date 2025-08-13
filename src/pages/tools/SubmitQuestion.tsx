import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/forms/TagInput";
import { useToast } from "@/hooks/use-toast";
import { useParams, useNavigate } from "react-router-dom";

export default function SubmitQuestion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lastSavedId, setLastSavedId] = useState<string | undefined>(id);

  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState({
    question_text: "",
    options: [
      { key: "A", text: "", explanation: "" },
      { key: "B", text: "", explanation: "" },
      { key: "C", text: "", explanation: "" },
      { key: "D", text: "", explanation: "" },
      { key: "E", text: "", explanation: "" },
    ],
    correct_answer: "A" as "A"|"B"|"C"|"D"|"E",
    exam_type: "",
    difficulty_level: "",
    topic: "",
    subtopic: "",
  });

  useEffect(() => {
    document.title = id ? "Edit Question • EM Gurus" : "Submit Question • EM Gurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", id ? "Edit an existing exam question." : "Submit a new exam question for review.");
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('exam_questions').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (data) setQuestion({
          question_text: (data as any).stem || (data as any).question_text || "",
          options: Array.isArray((data as any).choices) ?
            ["A","B","C","D","E"].map((k, i) => ({ key: k as any, text: (((data as any).choices[i]?.text ?? (data as any).choices[i] ?? "") as string), explanation: (((data as any).choices[i]?.explanation ?? "") as string) }))
            : ["A","B","C","D","E"].map((k)=>({ key: k as any, text: "", explanation: "" })),
          correct_answer: ((["A","B","C","D","E"][Number((data as any).correct_index ?? 0)] || 'A')) as any,
          exam_type: (data as any).exam_type || "",
          difficulty_level: (((data as any).difficulty_level || "") as any),
          topic: (data as any).topic || "",
          subtopic: (data as any).subtopic || "",
        });
      } catch (e: any) {
        toast({ title: 'Failed to load question', description: e.message, variant: 'destructive' });
      }
    })();
  }, [id]);

  const onChange = (patch: Partial<typeof question>) => setQuestion((q) => ({ ...q, ...patch }));

  const save = async () => {
    try {
      setSaving(true);
      const choiceTexts = question.options.map(o => o.text);
      const correctIndex = ["A","B","C","D","E"].indexOf(question.correct_answer);
      const explanation = question.options[correctIndex]?.explanation || "";
      if (id) {
        const { error } = await supabase
          .from('exam_questions')
          .update({ stem: question.question_text, choices: choiceTexts, correct_index: correctIndex as any, explanation, exam_type: (question.exam_type || 'OTHER') as any, topic: question.topic, subtopic: question.subtopic } as any)
          .eq('id', id);
        if (error) throw error;
        toast({ title: 'Saved', description: 'Question updated.' });
      } else {
        const { data, error } = await supabase.rpc('create_exam_draft', { p_stem: question.question_text, p_choices: choiceTexts, p_correct_index: correctIndex, p_explanation: explanation, p_tags: [], p_exam_type: (question.exam_type || 'OTHER') as any });
        if (error) throw error;
        toast({ title: 'Saved', description: 'Draft created.' });
        const newId = Array.isArray(data) && data.length ? (data[0] as any).id : undefined;
        if (newId) navigate(`/tools/submit-question/${newId}`);
      }
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const review = async () => {
    try {
      await save();
      const targetId = id || (new URL(location.href).pathname.split('/').pop() || undefined);
      if (targetId) {
        const { error } = await supabase.rpc('submit_exam_for_review', { p_question_id: targetId });
        if (error) throw error;
        toast({ title: 'Submitted for review' });
      }
    } catch (e:any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const difficulties = useMemo(() => ['easy','medium','hard'], []);

  const [examOptions, setExamOptions] = useState<string[]>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [subtopicOptions, setSubtopicOptions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [cm, eq] = await Promise.all([
          supabase.from('curriculum_map').select('exam_type'),
          supabase.from('exam_questions').select('topic, subtopic').limit(500),
        ]);
        const examTypes = Array.from(new Set(((cm.data as any[]) || []).map((r: any) => r.exam_type).filter(Boolean)));
        const topics = Array.from(new Set(((eq.data as any[]) || []).map((r: any) => r.topic).filter(Boolean)));
        const subs = Array.from(new Set(((eq.data as any[]) || []).map((r: any) => r.subtopic).filter(Boolean)));
        setExamOptions(examTypes);
        setTopicOptions(topics);
        setSubtopicOptions(subs);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <main className="container mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{id ? 'Edit Question' : 'Submit Question'}</h1>
        <p className="text-sm text-muted-foreground">Provide a clear stem, 5 answers (A–E), with per‑option explanations.</p>
      </header>

      <Card className="p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Question Stem</label>
          <Textarea rows={6} value={question.question_text} onChange={(e) => onChange({ question_text: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.options.map((opt, idx) => (
            <div key={opt.key} className="space-y-2">
              <div>
                <label className="text-sm font-medium">Option {opt.key}</label>
                <Input value={opt.text} onChange={(e) => {
                  const txt = e.target.value; setQuestion(q => { const next = { ...q, options: q.options.map((o,i)=> i===idx? { ...o, text: txt } : o) }; return next; });
                }} />
              </div>
              <div>
                <label className="text-sm font-medium">Explanation {opt.key}</label>
                <Textarea rows={3} value={opt.explanation} onChange={(e) => {
                  const val = e.target.value; setQuestion(q => { const next = { ...q, options: q.options.map((o,i)=> i===idx? { ...o, explanation: val } : o) }; return next; });
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Correct Answer</label>
            <Select value={question.correct_answer} onValueChange={(v) => onChange({ correct_answer: v as any })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {(["A","B","C","D","E"] as const).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Exam Type</label>
            <TagInput
              value={question.exam_type ? [question.exam_type] : []}
              onChange={(tags) => onChange({ exam_type: (tags[0] || '') })}
              suggestions={examOptions}
              maxTags={1}
              placeholder="Select exam type"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Difficulty</label>
            <Select value={question.difficulty_level} onValueChange={(v) => onChange({ difficulty_level: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Topic</label>
            <TagInput
              value={question.topic ? [question.topic] : []}
              onChange={(tags) => onChange({ topic: (tags[0] || '') })}
              suggestions={topicOptions}
              maxTags={1}
              placeholder="Select topic"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Subtopic</label>
            <TagInput
              value={question.subtopic ? [question.subtopic] : []}
              onChange={(tags) => onChange({ subtopic: (tags[0] || '') })}
              suggestions={subtopicOptions}
              maxTags={1}
              placeholder="Select subtopic"
            />
          </div>
        </div>



        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={saving} variant="outline" onClick={save}>Save</Button>
          <Button disabled={saving} onClick={review}>Submit</Button>
        </div>
      </Card>

      <link rel="canonical" href={`${window.location.origin}/tools/submit-question${id ? `/${id}` : ''}`} />
    </main>
  );
}
