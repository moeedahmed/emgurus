import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, Zap, BookOpen } from "lucide-react";

export default function Exams() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "EMGurus Exam Practice • EM Gurus";
    const desc = "Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { 
      meta = document.createElement('meta'); 
      meta.setAttribute('name','description'); 
      document.head.appendChild(meta); 
    }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <main>
      {/* Canonical tag for SEO */}
      <link rel="canonical" href={typeof window !== 'undefined' ? window.location.origin + '/exams' : '/exams'} />
      <PageHero 
        title="EMGurus Exam Practice" 
        subtitle="Targeted MCQs for MRCEM Primary, MRCEM SBA, and FRCEM. Learn smarter, score higher." 
        align="center" 
        ctas={[{ label: "Exam Membership", href: "/pricing", variant: "outline" }]} 
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl grid items-stretch gap-6 md:grid-cols-3">
          
          {/* AI Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">AI Mode</h3>
                <span className="ml-2 align-middle text-xs px-2 py-0.5 rounded-full border bg-primary/10 text-primary">Beta</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• AI-generated questions on demand</li>
                <li>• Instant explanations and feedback</li>
                <li>• Customizable by exam and topic</li>
                <li>• Dynamic difficulty adjustment</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/exams/ai-practice')}
                aria-label="Start AI Mode"
              >
                Start AI Mode
              </Button>
            </div>
          </Card>

          {/* Practice Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Practice Mode</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Curated questions from expert reviewers</li>
                <li>• See answers and explanations immediately</li>
                <li>• Untimed learning experience</li>
                <li>• Navigate freely between questions</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/exams/practice')}
                aria-label="Start Practice"
              >
                Start Practice
              </Button>
            </div>
          </Card>

          {/* Exam Mode */}
          <Card className="h-full p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Exam Mode</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Timed practice exams</li>
                <li>• Realistic exam conditions</li>
                <li>• Complete score analysis</li>
                <li>• Mark questions for review</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/exams/exam')}
                aria-label="Start Exam"
              >
                Start Exam
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}