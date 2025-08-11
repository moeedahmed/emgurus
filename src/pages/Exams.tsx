import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Exams() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "EMGurus Exam Practice • EM Gurus";
    const desc = "Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <main>
      <PageHero title="EMGurus Exam Practice" subtitle="Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher." align="center" ctas={[{ label: "Exam Membership", href: "/pricing", variant: "outline" }]} />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-2">
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">AI Practice (Beta)</h3>
              <p className="text-sm text-muted-foreground">
                Instantly generated MCQs with on-demand explanations.
              </p>
            </div>
            <div className="pt-6">
              <Button size="lg" onClick={() => navigate('/exams/ai-practice')} aria-label="Start AI Practice">
                Start AI Practice
              </Button>
            </div>
          </Card>

          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Question Bank</h3>
              <p className="text-sm text-muted-foreground">
                Human-reviewed MCQs. Filter by exam, topic, and difficulty. Track your progress.
              </p>
            </div>
            <div className="pt-6">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button onClick={() => navigate('/exams/reviewed?mode=practice')} aria-label="Practice mode">Practice mode</Button>
                <Button variant="outline" onClick={() => navigate('/exams/reviewed?mode=exam')} aria-label="Exam mode">Exam mode</Button>
                <Button variant="ghost" onClick={() => navigate('/exams/reviewed')} aria-label="Browse bank">Browse bank</Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
