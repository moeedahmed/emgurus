import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Star, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();
  
  const handlePlanClick = (planName: string) => {
    if (planName === "Free") {
      navigate("/quiz");
    } else {
      // TODO: Handle paid plan subscriptions
      console.log(`Selected plan: ${planName}`);
    }
  };

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started with medical learning",
      features: [
        "Access to community forums",
        "Basic career blog reading",
        "Limited AI interactions",
        "Public study groups",
        "Basic progress tracking",
      ],
      notIncluded: [
        "Exam practice",
        "Expert consultations",
        "Advanced AI features",
        "Premium content",
      ],
      buttonText: "Get Started Free",
      buttonVariant: "outline" as const,
      popular: false,
    },
    {
      name: "Exams",
      price: "$29",
      period: "month",
      description: "Comprehensive exam preparation with AI assistance",
      features: [
        "Unlimited practice exams",
        "AI-generated questions",
        "Detailed performance analytics",
        "Study plan recommendations",
        "All forum features",
        "Premium blog content",
        "CPD certificates",
        "Progress tracking",
      ],
      notIncluded: [
        "Expert consultations",
        "Priority support",
      ],
      buttonText: "Start Exam Prep",
      buttonVariant: "default" as const,
      popular: true,
    },
    {
      name: "Consultation",
      price: "$79",
      period: "month",
      description: "Full access including expert mentorship",
      features: [
        "Everything in Exams plan",
        "1:1 expert consultations",
        "Guru profile access",
        "Priority booking",
        "Video call sessions",
        "Personalized learning paths",
        "Advanced AI tutoring",
        "Priority support",
      ],
      notIncluded: [],
      buttonText: "Book Consultations",
      buttonVariant: "accent" as const,
      popular: false,
    },
    {
      name: "Premium",
      price: "$149",
      period: "month",
      description: "Complete platform access with unlimited features",
      features: [
        "Everything in Consultation plan",
        "Unlimited expert sessions",
        "Advanced AI features",
        "Custom study materials",
        "Priority guru matching",
        "Exclusive masterclasses",
        "White-glove onboarding",
        "24/7 premium support",
      ],
      notIncluded: [],
      buttonText: "Go Premium",
      buttonVariant: "hero" as const,
      popular: false,
      premium: true,
    },
  ];

  return (
    <section id="pricing" className="py-16 lg:py-24 bg-gradient-to-b from-secondary/30 to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Choose Your
            <span className="text-transparent bg-clip-text bg-gradient-hero block">
              Learning Path
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            From free community access to premium mentorship, 
            find the perfect plan for your medical education journey.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-strong ${
                plan.popular 
                  ? 'border-primary shadow-medium scale-105' 
                  : plan.premium
                  ? 'border-accent shadow-medium bg-gradient-card'
                  : 'hover:scale-105'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-primary text-primary-foreground text-center py-2 text-sm font-medium">
                  <Star className="w-4 h-4 inline mr-1" />
                  Most Popular
                </div>
              )}
              
              {plan.premium && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground text-center py-2 text-sm font-medium">
                  <Crown className="w-4 h-4 inline mr-1" />
                  Premium
                </div>
              )}

              <div className={`p-6 ${plan.popular || plan.premium ? 'pt-12' : ''}`}>
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-success mr-3 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Button */}
                <Button 
                  variant={plan.buttonVariant} 
                  className="w-full"
                  size="lg"
                  onClick={() => handlePlanClick(plan.name)}
                >
                  {plan.buttonText}
                </Button>

                {/* Not Included (for lower tiers) */}
                {plan.notIncluded.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Not included:</p>
                    <ul className="space-y-1">
                      {plan.notIncluded.map((feature, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">
                          • {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline">Compare All Features</Button>
            <Button variant="ghost">Contact Sales</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;