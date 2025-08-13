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

interface QuestionData {
  id?: string;
  stem: string;
  choices: { key: string; text: string }[];
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

  const [question, setQuestion] = useState<QuestionData>({
    stem: "",
    choices: [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" },
      { key: "E", text: "" }
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
  }, [isEditing, id]);

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
        setQuestion({
          id: data.id,
          stem: data.stem || "",
          choices: data.options ? (Array.isArray(data.options) ? data.options : JSON.parse(data.options)).map((opt: any, idx: number) => ({
            key: String.fromCharCode(65 + idx),
            text: typeof opt === 'string' ? opt : opt.text || ""
          })) : [
            { key: "A", text: "" },
            { key: "B", text: "" },
            { key: "C", text: "" },
            { key: "D", text: "" },
            { key: "E", text: "" }
          ],
            correct_answer: data.answer_key || "",
            explanation: data.explanation || "",
            exam_type: data.exam || "",
            topic: data.topic || "",
            curriculum: data.subtopic || "",
          difficulty: data.difficulty || ""
        });
      }
    } catch (error: any) {
      toast({ title: "Error loading question", description: error.message });
    } finally {
      setLoading(false);
    }
  };

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
    
    if (updates.exam_type) {
      updateTopicsForExam(updates.exam_type);
      // Reset topic and curriculum when exam type changes
      setQuestion(prev => ({ ...prev, ...updates, topic: "", curriculum: "" }));
    }
  };

  const save = async () => {
    if (!question.stem.trim() || question.choices.some(c => !c.text.trim())) {
      toast({ title: "Please fill in the question and all choices" });
      return;
    }

    setSaving(true);
    try {
      const questionData = {
        stem: question.stem,
        options: question.choices.map(c => c.text),
        answer_key: question.correct_answer,
        explanation: question.explanation,
        exam: question.exam_type,
        topic: question.topic,
        subtopic: question.curriculum,
        difficulty: question.difficulty,
      };

      let result;
      if (isEditing && question.id) {
        result = await supabase
          .from('reviewed_exam_questions')
          .update(questionData)
          .eq('id', question.id);
      } else {
        const user = await supabase.auth.getUser();
        result = await supabase
          .from('reviewed_exam_questions')
          .insert({
            ...questionData,
            status: 'draft',
            user_id: user.data.user?.id
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({ title: isEditing ? "Question updated!" : "Question saved!" });
      
      if (!isEditing && result.data) {
        navigate(`/tools/submit-question/${result.data.id}`);
      }
    } catch (error: any) {
      toast({ title: "Error saving question", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const assignToGuru = async () => {
    if (!question.id) return;
    
    try {
      // Here you would implement the assignment logic
      // For now, just show a success message
      toast({ title: "Question assigned to guru for review" });
    } catch (error: any) {
      toast({ title: "Error assigning question", description: error.message });
    }
  };

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
      <article className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? "Edit Question" : "Submit Question"}
        </h1>

        <Card className="p-6 space-y-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stem">Question</Label>
              <Textarea
                id="stem"
                value={question.stem}
                onChange={(e) => onChange({ stem: e.target.value })}
                placeholder="Enter your question here..."
                rows={4}
              />
            </div>

            <div className="grid gap-4">
              <Label>Answer Choices</Label>
              {question.choices.map((choice, index) => (
                <div key={choice.key} className="flex gap-3 items-center">
                  <span className="w-8 font-medium">{choice.key}.</span>
                  <Input
                    value={choice.text}
                    onChange={(e) => {
                      const newChoices = [...question.choices];
                      newChoices[index].text = e.target.value;
                      onChange({ choices: newChoices });
                    }}
                    placeholder={`Enter choice ${choice.key}`}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="correct">Correct Answer</Label>
                <Select value={question.correct_answer} onValueChange={(value) => onChange({ correct_answer: value })}>
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
                <Select value={question.exam_type} onValueChange={(value) => onChange({ exam_type: value })}>
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
                <Select value={question.difficulty} onValueChange={(value) => onChange({ difficulty: value })}>
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
                <Select value={question.topic} onValueChange={(value) => onChange({ topic: value })}>
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
                <Select value={question.curriculum} onValueChange={(value) => onChange({ curriculum: value })}>
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

            <div className="grid gap-2">
              <Label htmlFor="explanation">Explanation</Label>
              <Textarea
                id="explanation"
                value={question.explanation}
                onChange={(e) => onChange({ explanation: e.target.value })}
                placeholder="Explain the correct answer and reasoning..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            {isEditing && (
              <Button variant="outline" onClick={assignToGuru}>
                Assign to Guru for Review
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : (isEditing ? "Update Question" : "Save Question")}
            </Button>
          </div>
        </Card>
      </article>
    </main>
  );
}