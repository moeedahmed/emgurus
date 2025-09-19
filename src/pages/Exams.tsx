import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, Zap, BookOpen } from "lucide-react";

export default function Exams() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Exams | EM Gurus";
    const desc = "Practice MCQs and prepare for emergency medicine exams worldwide.";
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
        title="Exams" 
        subtitle="Practice MCQs and prepare for emergency medicine exams worldwide." 
        align="center" 
        ctas={[{ label: "Exams Membership", href: "/pricing", variant: "default" }]} 
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-screen-xl px-4">
          <div className="grid items-stretch gap-8 md:grid-cols-3">
          
          {/* AI Mode */}
          <Card className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0 flex flex-col h-full">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">AI Mode</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-primary/10 text-primary">Beta</span>
                </div>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>AI-generated questions on demand</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Instant explanations and feedback</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Customizable by exam and topic</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Dynamic difficulty adjustment</span>
                </li>
              </ul>
              
              <Button 
                size="lg" 
                className="w-full group mt-auto"
                onClick={() => navigate('/exams/ai-practice')}
                aria-label="Start AI Mode"
              >
                Start AI Mode
              </Button>
            </div>
          </Card>

          {/* Study Mode */}
          <Card className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0 flex flex-col h-full">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Study Mode</h3>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Curated questions from expert reviewers</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>See answers and explanations immediately</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Untimed learning experience</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Navigate freely between questions</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>AI Guru assistance available</span>
                </li>
              </ul>
              
              <Button 
                size="lg" 
                className="w-full group mt-auto"
                onClick={() => navigate('/exams/practice')}
                aria-label="Start Study Session"
              >
                Start Study Session
              </Button>
            </div>
          </Card>

          {/* Exam Mode */}
          <Card className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0 flex flex-col h-full">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Exam Mode</h3>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Timed practice exams</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Realistic exam conditions</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Complete score analysis</span>
                </li>
                <li className="flex items-start text-sm">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 mt-2 flex-shrink-0"></div>
                  <span>Mark questions for review</span>
                </li>
              </ul>
              
              <Button 
                size="lg" 
                className="w-full group mt-auto"
                onClick={() => navigate('/exams/exam')}
                aria-label="Start Exam"
              >
                Start Exam
              </Button>
            </div>
          </Card>
          </div>
        </div>
      </section>
    </main>
  );
}