import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, CheckCircle, Clock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ExamSelector from "@/components/ExamSelector";
import QuizInterface from "@/components/QuizInterface";

interface QuizConfig {
  examType: string;
  difficulty: string;
  topic: string;
  type: 'realtime' | 'reviewed';
}

const Quiz = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [selectedOption, setSelectedOption] = useState<'realtime' | 'reviewed' | null>(null);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleStartQuiz = (config: QuizConfig) => {
    setQuizConfig(config);
  };

  const handleBackToSelection = () => {
    if (quizConfig) {
      setQuizConfig(null);
    } else {
      setSelectedOption(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-primary">EMGurus Quiz</span>
            </div>
            <div></div>
          </div>
        </div>
      </div>

          {/* Main Content */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-4xl mx-auto">
              {!selectedOption && !quizConfig && (
                <>
                  {/* Title */}
                  <div className="text-center mb-12">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                      Choose Your Quiz Type
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      Select how you'd like to practice your medical knowledge
                    </p>
                  </div>

                  {/* Quiz Options */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* AI Real-time Questions */}
                    <Card 
                      className="p-8 hover:shadow-strong transition-all duration-300 hover:scale-105 cursor-pointer border-2 hover:border-primary"
                      onClick={() => setSelectedOption('realtime')}
                    >
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Zap className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">AI Real-time Questions</h3>
                        <p className="text-muted-foreground">
                          Fresh questions generated instantly by AI based on your selected topics
                        </p>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">Unlimited unique questions</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">Adaptive difficulty</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">Instant generation</span>
                        </div>
                      </div>

                      <div className="mb-6">
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Not Guru-reviewed
                        </Badge>
                      </div>
                    </Card>

                    {/* Reviewed Questions */}
                    <Card 
                      className="p-8 hover:shadow-strong transition-all duration-300 hover:scale-105 cursor-pointer border-2 hover:border-primary"
                      onClick={() => setSelectedOption('reviewed')}
                    >
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Guru-Reviewed Questions</h3>
                        <p className="text-muted-foreground">
                          Curated question bank reviewed and approved by medical experts
                        </p>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">Expert-verified accuracy</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">High-quality explanations</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm">Proven exam relevance</span>
                        </div>
                      </div>

                      <div className="mb-6">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Guru-approved
                        </Badge>
                      </div>
                    </Card>
                  </div>

                  {/* Free Tier Notice */}
                  <div className="mt-12 text-center">
                    <Card className="p-6 bg-secondary/30 border-dashed">
                      <h4 className="font-semibold mb-2">Free Tier Access</h4>
                      <p className="text-sm text-muted-foreground">
                        You're currently on the free tier. Upgrade to unlock unlimited practice sessions, 
                        detailed analytics, and premium question banks.
                      </p>
                      <Button variant="outline" className="mt-4" onClick={() => navigate('/#pricing')}>
                        View Pricing Plans
                      </Button>
                    </Card>
                  </div>
                </>
              )}

              {/* Exam Selector */}
              {selectedOption && !quizConfig && (
                <ExamSelector 
                  type={selectedOption} 
                  onStartQuiz={handleStartQuiz}
                />
              )}

              {/* Quiz Interface */}
              {quizConfig && (
                <QuizInterface 
                  config={quizConfig}
                  onBack={handleBackToSelection}
                />
              )}
            </div>
          </div>
    </div>
  );
};

export default Quiz;