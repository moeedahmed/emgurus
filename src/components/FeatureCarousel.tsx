import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useNavigate } from "react-router-dom";
import { 
  Brain, 
  BookOpen, 
  Video, 
  Users,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import examImage from "@/assets/exam-preparation-icon.jpg";
import mentoringImage from "@/assets/mentoring-consultation.jpg";
import blogImage from "@/assets/medical-blog.jpg";

const FeatureCarousel = () => {
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
      title: "Expert Consults",
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
    {
      icon: Users,
      title: "Community Forums",
      description: "Peer discussion and shared learning with fellow medical professionals",
      image: blogImage, // Reusing blog image for now
      highlights: ["Ask and answer questions", "Share resources and tips", "Learn from global peers"],
      href: "/forums",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="heading-xl mb-6">
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

        {/* Mobile Carousel */}
        <div className="md:hidden">
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {features.map((feature, index) => (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-[85%]">
                  <Card className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0">
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        loading="lazy"
                        decoding="async"
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
                      
                      <Button variant="outline" className="w-full group" onClick={() => navigate(feature.href)}>
                        Learn More
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden group hover:shadow-strong transition-all duration-300 bg-gradient-card border-0"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={feature.image}
                  alt={feature.title}
                  loading="lazy"
                  decoding="async"
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
                
                <Button variant="outline" className="w-full group" onClick={() => navigate(feature.href)}>
                  Learn More
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureCarousel;