import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star, Users } from "lucide-react";
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
            <div className="flex items-center space-x-2 mb-6">
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Trusted by learners worldwide
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Empowering Emergency Medicine & Healthcare Careers
              <span className="text-transparent bg-clip-text bg-gradient-hero block">
                with AI, Mentorship, and Global Collaboration
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Personalized AI tutoring, expert mentorship, and collaborative learning built for modern medical careers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {user ? (
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="group"
                  onClick={() => navigate('/exams')}
                >
                  Continue Exams
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="group"
                  onClick={() => navigate('/auth')}
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
              <Button variant="outline" size="lg" className="group" onClick={() => navigate('/#pricing')}>
                <Play className="w-5 h-5 mr-2" />
                Compare Plans
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">Growing</div>
                <div className="text-sm text-muted-foreground">Question Bank</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">Building</div>
                <div className="text-sm text-muted-foreground">Verified Mentors</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-primary">Beta</div>
                <div className="text-sm text-muted-foreground">Outcomes Tracking</div>
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