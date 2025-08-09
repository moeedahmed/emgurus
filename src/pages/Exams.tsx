import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Exams() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Exams • EM Gurus";
    const desc = "Practice exams via AI or browse the reviewed bank.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <main>
      <PageHero title="Exam Practice" subtitle="AI practice (Beta) or Guru‑reviewed bank — pick a mode." />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">AI Practice (Beta)</h3>
              <ul className="list-disc ml-5 text-sm text-muted-foreground space-y-1">
                <li>Generate fresh MCQs instantly</li>
                <li>Choose exam, count, and curriculum</li>
                <li>Compact play session with explanations</li>
              </ul>
            </div>
            <div className="pt-4">
              <Button onClick={() => navigate('/exams/ai-practice')} aria-label="Configure & Start AI Practice">Configure & Start</Button>
            </div>
          </Card>
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Reviewed Question Bank</h3>
              <ul className="list-disc ml-5 text-sm text-muted-foreground space-y-1">
                <li>Guru‑reviewed questions</li>
                <li>Filter by exam and curriculum</li>
                <li>Fast search and paging</li>
              </ul>
            </div>
            <div className="pt-4">
              <Button variant="outline" onClick={() => navigate('/exams/question-bank')} aria-label="Browse reviewed questions">Browse</Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
