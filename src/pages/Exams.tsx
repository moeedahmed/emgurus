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
              <h3 className="text-xl font-semibold mb-2">Realtime AI Questions</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instantly generated MCQs</li>
                <li>• Immediate, concise explanations</li>
                <li>• Topic‑guided practice</li>
              </ul>
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
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Reviewed by Gurus</li>
                <li>• Filter by exam and topic</li>
                <li>• Track your progress</li>
              </ul>
            </div>
            <div className="pt-6">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button onClick={() => navigate('/exams/reviewed?mode=practice')} aria-label="Practice mode">Practice mode</Button>
                <Button onClick={() => navigate('/exams/reviewed?mode=exam')} aria-label="Exam mode">Exam mode</Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
