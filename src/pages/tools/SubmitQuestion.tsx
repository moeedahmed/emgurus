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

  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState({
    question_text: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "A" as "A"|"B"|"C"|"D",
    explanation: "",
    exam_type: "",
    difficulty_level: "",
    topic: "",
    subtopic: "",
    keywords: [] as string[],
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
        const { data, error } = await supabase.from('questions').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (data) setQuestion({
          question_text: data.question_text || "",
          option_a: data.option_a || "",
          option_b: data.option_b || "",
          option_c: data.option_c || "",
          option_d: data.option_d || "",
          correct_answer: (data.correct_answer || 'A') as any,
          explanation: data.explanation || "",
          exam_type: data.exam_type || "",
          difficulty_level: data.difficulty_level || "",
          topic: data.topic || "",
          subtopic: data.subtopic || "",
          keywords: Array.isArray(data.keywords) ? data.keywords : [],
        });
      } catch (e: any) {
        toast({ title: 'Failed to load question', description: e.message, variant: 'destructive' });
      }
    })();
  }, [id]);

  const onChange = (patch: Partial<typeof question>) => setQuestion((q) => ({ ...q, ...patch }));

  const save = async (status: 'draft' | 'pending') => {
    try {
      setSaving(true);
      if (id) {
        const { error } = await supabase.from('questions').update({ ...question, status }).eq('id', id);
        if (error) throw error;
        toast({ title: 'Saved', description: 'Question updated.' });
      } else {
        const { data, error } = await supabase.from('questions').insert({ ...question, status }).select('id').maybeSingle();
        if (error) throw error;
        toast({ title: 'Submitted', description: status === 'pending' ? 'Sent for review.' : 'Saved as draft.' });
        if (data?.id) navigate(`/tools/submit-question/${data.id}`);
      }
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const difficulties = useMemo(() => ['easy','medium','hard'], []);

  return (
    <main className="container mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{id ? 'Edit Question' : 'Submit Question'}</h1>
        <p className="text-sm text-muted-foreground">Provide a clear stem, 4 answers (A–D), explanation, and tags.</p>
      </header>

      <Card className="p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Question (stem)</label>
          <Textarea rows={6} value={question.question_text} onChange={(e) => onChange({ question_text: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Option A</label>
            <Input value={question.option_a} onChange={(e) => onChange({ option_a: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Option B</label>
            <Input value={question.option_b} onChange={(e) => onChange({ option_b: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Option C</label>
            <Input value={question.option_c} onChange={(e) => onChange({ option_c: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Option D</label>
            <Input value={question.option_d} onChange={(e) => onChange({ option_d: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Correct Answer</label>
            <Select value={question.correct_answer} onValueChange={(v) => onChange({ correct_answer: v as any })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {(['A','B','C','D'] as const).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Exam Type</label>
            <Input value={question.exam_type} onChange={(e) => onChange({ exam_type: e.target.value })} placeholder="e.g. mrcem primary" />
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
            <Input value={question.topic} onChange={(e) => onChange({ topic: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Subtopic</label>
            <Input value={question.subtopic} onChange={(e) => onChange({ subtopic: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Tags</label>
          <TagInput value={question.keywords} onChange={(tags) => onChange({ keywords: tags })} placeholder="Add tags and hit Enter" />
        </div>

        <div>
          <label className="text-sm font-medium">Explanation</label>
          <Textarea rows={4} value={question.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={saving} variant="outline" onClick={() => save('draft')}>Save Draft</Button>
          <Button disabled={saving} onClick={() => save('pending')}>{id ? 'Save & Resubmit' : 'Submit for Review'}</Button>
        </div>
      </Card>

      <link rel="canonical" href={`${window.location.origin}/tools/submit-question${id ? `/${id}` : ''}`} />
    </main>
  );
}
