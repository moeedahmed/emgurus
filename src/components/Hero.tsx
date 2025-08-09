import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import heroImage from "@/assets/hero-medical-education.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-accent/10 py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="animate-fade-in">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Master EM Exams.
              <span className="text-transparent bg-clip-text bg-gradient-hero block">
                Get Mentored.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              AI practice, guru‑reviewed questions, and 1:1 mentorship built for emergency medicine clinicians.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-3">
              {user ? (
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="group"
                  onClick={() => navigate('/exams')}
                >
                  Start Exam Prep
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="group"
                  onClick={() => navigate('/exams')}
                >
                  Start Exam Prep
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="lg"
                className="group"
                onClick={() => navigate('/consultations')}
              >
                Book a Guru
              </Button>
            </div>
            <div>
              <a href="/#pricing" className="text-sm underline text-muted-foreground hover:text-primary">See pricing</a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-border">
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">50K+</div>
                <div className="text-sm text-muted-foreground">Practice Questions</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">Expert Mentors</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">95%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
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
                <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">AI Tutor Active</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-card rounded-lg shadow-medium p-4 border border-border">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">1,247 online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;