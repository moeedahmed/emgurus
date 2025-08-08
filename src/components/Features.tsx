import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Brain, 
  BookOpen, 
  Video, 
  Users, 
  Trophy, 
  Zap,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import examImage from "@/assets/exam-preparation-icon.jpg";
import mentoringImage from "@/assets/mentoring-consultation.jpg";
import blogImage from "@/assets/medical-blog.jpg";

const Features = () => {
  const navigate = useNavigate();
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Exams",
      description: "Smart question generation and personalized learning paths",
      image: examImage,
      highlights: ["Growing question bank", "Real-time feedback", "Adaptive difficulty"],
      href: "/exams",
    },
    {
      icon: Video,
      title: "Expert Consultations",
      description: "1:1 mentoring sessions with verified medical professionals",
      image: mentoringImage,
      highlights: ["Verified gurus (in review)", "Flexible scheduling", "All specialties"],
      href: "/consultations",
    },
    {
      icon: BookOpen,
      title: "Career Blogs",
      description: "AI-summarized insights and peer-reviewed content",
      image: blogImage,
      highlights: ["Expert articles", "AI summaries", "Peer reviews"],
      href: "/blogs",
    },
  ];

  const capabilities = [
    {
      icon: Zap,
      title: "Real-time AI Tutoring",
      description: "Get instant explanations and learning guidance",
    },
    {
      icon: Trophy,
      title: "Gamified Learning",
      description: "Earn badges, track progress, and compete with peers",
    },
    {
      icon: Users,
      title: "Community Forums",
      description: "Connect with medical professionals worldwide",
    },
  ];

  return (
    <section id="features" className="py-16 lg:py-24 bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Everything You Need to
            <span className="text-transparent bg-clip-text bg-gradient-hero block">
              Excel in Medicine
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            From AI-powered exam preparation to expert mentorship, 
            EM Gurus provides a comprehensive platform for medical learning.
          </p>
        </div>

        {/* Main Features */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                </div>
                
                <p className="text-muted-foreground mb-4">
                  {feature.description}
                </p>
                
                <ul className="space-y-2 mb-6">
                  {feature.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-success mr-2" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                
                <Button variant="outline" className="w-full group" onClick={() => navigate((feature as any).href)}>
                  Learn More
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Additional Capabilities */}
        <div className="grid md:grid-cols-3 gap-8">
          {capabilities.map((capability, index) => (
            <div key={index} className="text-center group">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <capability.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{capability.title}</h3>
              <p className="text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;