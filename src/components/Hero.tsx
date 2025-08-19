import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import heroImage from "@/assets/hero-medical-education.jpg";

import { useNavigate } from "react-router-dom";

const Hero = () => {
  
  const navigate = useNavigate();
  return (
    <section className="section-spacing relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <div className="page-container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="animate-fade-in content-spacing">

            <h1 className="heading-display mb-6">
              Master EM Exams.
              <span className="text-transparent bg-clip-text bg-gradient-hero block">
                Get Mentored.
              </span>
            </h1>

            <p className="body-lg text-muted-foreground mb-8">
              AI practice, guru‑reviewed questions, and 1:1 mentorship built for emergency medicine clinicians.
            </p>

            <div className="flex-responsive justify-center sm:justify-start">
              <Button
                variant="default"
                size="lg"
                className="group w-full sm:w-auto max-w-[320px] hover-lift focus-ring touch-target"
                onClick={() => navigate('/exams')}
                role="button"
                aria-label="Start exam preparation"
              >
                Start Exam Prep
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="group w-full sm:w-auto max-w-[320px] hover-lift focus-ring touch-target"
                onClick={() => navigate('/consultations')}
                role="button"
                aria-label="Book a Guru consultation"
              >
                Book a Guru
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="group w-full sm:w-auto max-w-[320px] hover-lift focus-ring touch-target"
              >
                <a href="/#pricing" role="button" aria-label="See pricing">See Pricing</a>
              </Button>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-slide-in">
            <div className="relative">
              <img
                src={heroImage}
                alt="Medical professionals collaborating with AI technology"
                className="w-full h-auto rounded-2xl shadow-strong"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-2xl"></div>
            </div>

            {/* Floating Cards */}
            <div className="absolute -top-4 -right-4 bg-card rounded-lg shadow-medium p-4 border border-border">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse" aria-hidden="true"></div>
                <span className="body-sm font-medium">AI Tutor Active</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-card rounded-lg shadow-medium p-4 border border-border">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-accent" aria-hidden="true" />
                <span className="body-sm font-medium">1,247 online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;