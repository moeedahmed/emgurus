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
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-3">
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
              <Button size="lg" onClick={() => navigate('/exams/ai-practice')} aria-label="Practice Mode">
                Practice Mode
              </Button>
            </div>
          </Card>

          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Exam Mode</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Timed session from reviewed bank</li>
                <li>• Randomized options with summary</li>
                <li>• Track performance by topic</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button size="lg" onClick={() => navigate('/exams/reviewed-exam')} aria-label="Exam Mode">
                Exam Mode
              </Button>
            </div>
          </Card>

          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">Question Bank</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Reviewed by Gurus</li>
                <li>• Filter by exam and topic</li>
                <li>• Browse stems quickly</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button size="lg" onClick={() => navigate('/exams/reviewed')} aria-label="Browse Question Bank">
                Browse Question Bank
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
