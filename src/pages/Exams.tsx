import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Exams() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "EMGurus Exam Practice • EM Gurus";
    const desc = "Targeted Emergency Medicine exam prep for MRCEM Primary, MRCEM SBA, and FRCEM SBA — learn smarter, score higher.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <main>
      <PageHero title="EMGurus Exam Practice" subtitle="Targeted Emergency Medicine exam prep for MRCEM Primary, MRCEM SBA, and FRCEM SBA — learn smarter, score higher." align="center" ctas={[{ label: "Exams monthly membership", href: "/membership/exams", variant: "outline" }]} />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-2">
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-xl font-semibold mb-2">AI Practice (Beta)</h3>
              <p className="text-sm text-muted-foreground">
                Generate fresh MCQs instantly, tailored to your chosen exam and RCEM curriculum topics. Practice anytime with instant explanations.
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
              <h3 className="text-xl font-semibold mb-2">Guru‑Reviewed Question Bank</h3>
              <p className="text-sm text-muted-foreground">
                Access expert-reviewed MCQs aligned with the RCEM curriculum. Filter by exam or topic, track your progress.
              </p>
            </div>
            <div className="pt-6">
              <Button size="lg" variant="outline" onClick={() => navigate('/exams/reviewed')} aria-label="Browse Question Bank">
                Browse Question Bank
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
