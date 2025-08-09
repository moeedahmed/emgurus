import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/exams/QuestionCard";

interface Q { id: string; stem: string; options: string[]; correct: string; explanation?: string }

export default function AiPracticeSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [show, setShow] = useState(false);

  const store = useMemo(() => JSON.parse(localStorage.getItem('ai_sessions') || '{}'), []);
  const session = store[id || ""] || null;
  const questions: Q[] = session?.questions || [];
  const q = questions[idx] as Q | undefined;

  useEffect(() => {
    document.title = "AI Practice Session • EM Gurus";
  }, []);

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mb-3 font-medium">Session not found</div>
            <Button variant="outline" onClick={() => navigate('/exams/ai-practice')}>Back to setup</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = () => { setShow(true); };
  const next = () => { setShow(false); setSelected(""); setIdx(i => Math.min(i + 1, questions.length - 1)); };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Question {idx + 1} of {questions.length}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {q && (
            <QuestionCard
              stem={q.stem}
              options={q.options.map((t, i) => ({ key: String.fromCharCode(65 + i), text: t.replace(/^\w\.\s*/, '') }))}
              selectedKey={selected}
              onSelect={setSelected}
              showExplanation={show}
              explanation={q.explanation}
            />
          )}
          <div className="flex items-center gap-2 justify-end">
            {!show ? (
              <Button onClick={submit} disabled={!selected}>Submit</Button>
            ) : (
              <>
                {idx < questions.length - 1 ? (
                  <Button onClick={next}>Next</Button>
                ) : (
                  <Button variant="outline" onClick={() => navigate('/exams')}>Finish</Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
