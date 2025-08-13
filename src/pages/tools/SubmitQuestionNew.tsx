import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/forms/TagInput";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import QuestionChat from "@/components/exams/QuestionChat";

interface QuestionData {
  id?: string;
  stem: string;
  choices: { key: string; text: string; explanation?: string }[];
  correct_answer: string;
  explanation: string;
  exam_type: string;
  topic: string;
  curriculum: string;
  difficulty: string;
}

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

export default function SubmitQuestionNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const { isAdmin } = useRoles();

  const [question, setQuestion] = useState<QuestionData>({
    stem: "",
    choices: [
      { key: "A", text: "", explanation: "" },
      { key: "B", text: "", explanation: "" },
      { key: "C", text: "", explanation: "" },
      { key: "D", text: "", explanation: "" },
      { key: "E", text: "", explanation: "" }
    ],
    correct_answer: "",
    explanation: "",
    exam_type: "",
    topic: "",
    curriculum: "",
    difficulty: ""
  });

  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [curricula, setCurricula] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gurus, setGurus] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuruId, setSelectedGuruId] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [nextId, setNextId] = useState<string | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [questionStatus, setQuestionStatus] = useState<string | null>(null);

  useEffect(() => {
    document.title = isEditing ? "Edit Question | EMGurus" : "Submit Question | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { 
      meta = document.createElement('meta'); 
      meta.setAttribute('name', 'description'); 
      document.head.appendChild(meta); 
    }
    meta.setAttribute('content', isEditing ? 'Edit and update exam questions with full admin control.' : 'Submit new exam questions for review by medical education experts.');
    
    loadDropdownData();
    if (isEditing && id) {
      loadQuestionForEdit(id);
    }
    if (isEditing && isAdmin) {
      loadGurus();
    }
  }, [isEditing, id, isAdmin]);

  const loadDropdownData = async () => {
    try {
      // Load exam types from enum
      const examTypesData = ['MRCEM_PRIMARY', 'MRCEM_SBA', 'FRCEM_SBA'];
      setExamTypes(examTypesData);

      // Load topics and curricula from curriculum_map
      const { data: curriculumData } = await supabase
        .from('curriculum_map')
        .select('slo_title, key_capability_title, exam_type')
        .order('slo_title');

      if (curriculumData) {
        const uniqueTopics = [...new Set(curriculumData.map(item => item.slo_title))];
        const uniqueCurricula = [...new Set(curriculumData.map(item => item.key_capability_title))];
        setTopics(uniqueTopics);
        setCurricula(uniqueCurricula);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const loadGurus = async () => {
    try {
      const { data: guruProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', (
          (await supabase.from('user_roles').select('user_id').eq('role', 'guru')).data || []
        ).map((r: any) => r.user_id));
      
      setGurus((guruProfiles || []).map((p: any) => ({ id: p.user_id, name: p.full_name || 'Unknown' })));
    } catch (error) {
      console.error('Error loading gurus:', error);
    }
  };

  const loadQuestionForEdit = async (questionId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviewed_exam_questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error) throw error;

      if (data) {
        const answerKey = data.answer_key || "";
        const parsedOptions = data.options ? (Array.isArray(data.options) ? data.options : JSON.parse(data.options)) : [];
        const mappedChoices = (parsedOptions.length ? parsedOptions : ["", "", "", "", ""]).map((opt: any, idx: number) => {
          const key = String.fromCharCode(65 + idx);
          const text = typeof opt === 'string' ? opt : opt.text || "";
          const optExplanation = typeof opt === 'string' ? '' : (opt.explanation || '');
          const explanation = optExplanation;
          return { key, text, explanation };
        });

        const correctExplanation = (data.explanation || mappedChoices.find(c => c.key === answerKey)?.explanation || '');

        setQuestion({
          id: data.id,
          stem: data.stem || "",
          choices: mappedChoices,
          correct_answer: answerKey,
          explanation: correctExplanation,
          exam_type: data.exam || "",
          topic: data.topic || "",
          curriculum: data.subtopic || "",
          difficulty: data.difficulty || ""
        });

        setCreatedAt((data as any).created_at || "");
        setQuestionStatus((data as any).status || null);
        setIsDirty(false);
        await loadAdjacent((data as any).created_at || "", data.id);

        // Load existing assignment
        const { data: assignment } = await supabase
          .from('exam_review_assignments')
          .select('reviewer_id')
          .eq('question_id', questionId)
          .maybeSingle();
        if (assignment) setSelectedGuruId(assignment.reviewer_id);
      }
    } catch (error: any) {
      toast({ title: "Error loading question", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadAdjacent = async (createdAtVal: string, currentId: string) => {
    try {
      if (!createdAtVal || !currentId) { setNextId(null); setPrevId(null); return; }
      const [nextRes, prevRes] = await Promise.all([
        supabase
          .from('reviewed_exam_questions')
          .select('id, created_at')
          .or(`created_at.gt.${createdAtVal},and(created_at.eq.${createdAtVal},id.gt.${currentId})`)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(1),
        supabase
          .from('reviewed_exam_questions')
          .select('id, created_at')
          .or(`created_at.lt.${createdAtVal},and(created_at.eq.${createdAtVal},id.lt.${currentId})`)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1),
      ]);
      const nextRow = (nextRes.data && nextRes.data[0]) as any;
      const prevRow = (prevRes.data && prevRes.data[0]) as any;
      setNextId(nextRow ? nextRow.id : null);
      setPrevId(prevRow ? prevRow.id : null);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const updateTopicsForExam = (examType: string) => {
    if (!examType) {
      setTopics([]);
      setCurricula([]);
      return;
    }

    // Filter topics and curricula based on selected exam type
    supabase
      .from('curriculum_map')
      .select('slo_title, key_capability_title')
      .eq('exam_type', examType as any)
      .then(({ data }) => {
        if (data) {
          const uniqueTopics = [...new Set(data.map(item => item.slo_title))];
          const uniqueCurricula = [...new Set(data.map(item => item.key_capability_title))];
          setTopics(uniqueTopics);
          setCurricula(uniqueCurricula);
        }
      });
  };

  const onChange = (updates: Partial<QuestionData>) => {
    setQuestion(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    
    if (updates.exam_type) {
      updateTopicsForExam(updates.exam_type);
      // Reset topic and curriculum when exam type changes
      setQuestion(prev => ({ ...prev, ...updates, topic: "", curriculum: "" }));
    }
  };

  const save = async (statusOverride?: 'draft' | 'under_review') => {
    if (!question.stem.trim() || question.choices.some(c => !c.text.trim())) {
      toast({ title: "Please fill in the question and all choices" });
      return;
    }

    setSaving(true);
    try {
      const options = question.choices.map(c => ({ key: c.key, text: c.text, explanation: c.explanation || "" }));
      const correctChoice = question.choices.find(c => c.key === question.correct_answer);
      const explanationForCorrect = correctChoice?.explanation || question.explanation || "";
      const questionData: any = {
        stem: question.stem,
        options,
        answer_key: question.correct_answer,
        explanation: explanationForCorrect,
        exam: question.exam_type,
        topic: question.topic,
        subtopic: question.curriculum,
        difficulty: question.difficulty,
      };
      if (statusOverride) questionData.status = statusOverride;

      let result;
      if (isEditing && question.id) {
        result = await supabase
          .from('reviewed_exam_questions')
          .update(questionData)
          .eq('id', question.id)
          .select()
          .maybeSingle();
      } else {
        const user = await supabase.auth.getUser();
        result = await supabase
          .from('reviewed_exam_questions')
          .insert({
            ...questionData,
            status: statusOverride || 'draft',
            user_id: user.data.user?.id
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const savedId = (result.data as any)?.id || question.id;
      if (savedId && !question.id) setQuestion(prev => ({ ...prev, id: savedId }));

      const newStatus = (result.data as any)?.status;
      if (newStatus) setQuestionStatus(newStatus);
      setIsDirty(false);

      toast({ title: isEditing ? "Question updated!" : "Question saved!" });
      if (!isEditing && result.data) {
        navigate(`/tools/submit-question/${(result.data as any).id}`);
      }
    } catch (error: any) {
      toast({ title: "Error saving question", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleBlurAutosave = async () => {
    if (!isEditing && isDirty && !saving) {
      await save('draft');
    }
  };

  const confirmIfDirty = () => !isDirty || window.confirm('You have unsaved changes. Discard them?');
  const safeNavigate = (to: string | number) => {
    if (!confirmIfDirty()) return;
    if (typeof to === 'number') navigate(to as number);
    else navigate(to as string);
  };

  const assignToGuru = async () => {
    if (!question.id || !selectedGuruId) {
      toast({ title: "Select a guru first" });
      return;
    }
    try {
      const me = await supabase.auth.getUser();
      const { error } = await supabase
        .from('exam_review_assignments')
        .upsert({ question_id: question.id, reviewer_id: selectedGuruId, assigned_by: me.data.user?.id, status: 'assigned' }, { onConflict: 'question_id,reviewer_id' });
      if (error) throw error;
      toast({ title: "Assigned for review" });
    } catch (error: any) {
      toast({ title: "Error assigning question", description: error.message });
    }
  };

  const goNext = () => { if (nextId) safeNavigate(`/tools/submit-question/${nextId}`); };
  const goPrev = () => { if (prevId) safeNavigate(`/tools/submit-question/${prevId}`); };

  if (loading) {
    return (
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading question...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <article className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? "Edit Question" : "Submit Question"}
        </h1>

        {isEditing && (
          <div className="sticky top-16 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-md px-4 py-2 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">ID: {question.id}</span>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="status-select" className="text-sm">Status:</Label>
                  <Select value={questionStatus || ""} onValueChange={(value) => {
                    setQuestionStatus(value);
                    save(value as 'draft' | 'under_review');
                  }}>
                    <SelectTrigger id="status-select" className="w-32 h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isAdmin && (
                <span className="text-sm font-medium">Status: {questionStatus || '—'}</span>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="p-6 space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stem">Question</Label>
                  <Textarea
                    id="stem"
                    value={question.stem}
                    onChange={(e) => onChange({ stem: e.target.value })}
                    onBlur={handleBlurAutosave}
                    placeholder="Enter your question here..."
                    rows={4}
                  />
                </div>

                <div className="grid gap-4">
                  <Label>Answer Choices</Label>
                  {question.choices.map((choice, index) => (
                    <div key={choice.key} className="grid gap-2">
                      <div className="flex gap-3 items-center">
                        <span className="w-8 font-medium">{choice.key}.</span>
                        <Input
                          value={choice.text}
                          onChange={(e) => {
                            const newChoices = [...question.choices];
                            newChoices[index].text = e.target.value;
                            onChange({ choices: newChoices });
                          }}
                          onBlur={handleBlurAutosave}
                          placeholder={`Enter choice ${choice.key}`}
                        />
                      </div>
                      <div className="pl-11">
                        <Textarea
                          value={choice.explanation || ""}
                          onChange={(e) => {
                            const newChoices = [...question.choices];
                            newChoices[index].explanation = e.target.value;
                            onChange({ choices: newChoices });
                          }}
                          onBlur={handleBlurAutosave}
                          rows={3}
                          placeholder={`Why is option ${choice.key} correct/incorrect?`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="correct">Correct Answer</Label>
                    <Select value={question.correct_answer} onValueChange={(value) => { onChange({ correct_answer: value }); void handleBlurAutosave(); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {question.choices.map((choice) => (
                          <SelectItem key={choice.key} value={choice.key}>
                            {choice.key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="exam-type">Exam Type</Label>
                    <Select value={question.exam_type} onValueChange={(value) => { onChange({ exam_type: value }); void handleBlurAutosave(); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select exam type" />
                      </SelectTrigger>
                      <SelectContent>
                        {examTypes.map((exam) => (
                          <SelectItem key={exam} value={exam}>
                            {exam.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select value={question.difficulty} onValueChange={(value) => { onChange({ difficulty: value }); void handleBlurAutosave(); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="topic">Topic</Label>
                    <Select value={question.topic} onValueChange={(value) => { onChange({ topic: value }); void handleBlurAutosave(); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select topic" />
                      </SelectTrigger>
                      <SelectContent>
                        {topics.map((topic) => (
                          <SelectItem key={topic} value={topic}>
                            {topic}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="curriculum">Curriculum</Label>
                    <Select value={question.curriculum} onValueChange={(value) => { onChange({ curriculum: value }); void handleBlurAutosave(); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        {curricula.map((curriculum) => (
                          <SelectItem key={curriculum} value={curriculum}>
                            {curriculum}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                 </div>

                {/* Guru Assignment Section - Only for Admins in Edit Mode */}
                {isEditing && isAdmin && (
                  <div className="grid gap-2 p-4 border rounded-lg bg-muted/50">
                    <Label htmlFor="guru-select">Assign to Guru for Review</Label>
                    <div className="flex gap-2">
                      <Select value={selectedGuruId} onValueChange={setSelectedGuruId}>
                        <SelectTrigger id="guru-select" className="flex-1">
                          <SelectValue placeholder="Select a guru..." />
                        </SelectTrigger>
                        <SelectContent>
                          {gurus.map((guru) => (
                            <SelectItem key={guru.id} value={guru.id}>
                              {guru.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={assignToGuru} disabled={!selectedGuruId}>
                        Assign
                      </Button>
                    </div>
                  </div>
                )}

              </div>

              <div className="space-y-4">

                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {isEditing && (
                      <>
                        <Button variant="outline" onClick={() => safeNavigate('/exams/question-bank')}>
                          Back to Bank
                        </Button>
                        <Button variant="outline" onClick={goPrev} disabled={!prevId}>Previous</Button>
                        <Button variant="outline" onClick={goNext} disabled={!nextId}>Next</Button>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => safeNavigate(-1)}>
                      Back
                    </Button>
                    {!isEditing && (
                      <Button variant="outline" onClick={() => save('draft')} disabled={saving}>
                        Add to Draft
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => save('under_review')} disabled={saving}>
                      Submit for Review
                    </Button>
                    <Button onClick={() => save()} disabled={saving}>
                      {saving ? "Saving..." : (isEditing ? "Update Question" : "Save Question")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            {question.id && <QuestionChat questionId={question.id} />}
          </div>
        </div>
      </article>
    </main>
  );
}