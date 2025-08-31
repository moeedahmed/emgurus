import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import MarkForReviewButton from "@/components/exams/MarkForReviewButton";

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  is_ai_generated: boolean;
  reviewed_by?: string;
}

interface QuizConfig {
  examType: string;
  difficulty: string;
  topic: string;
  type: 'realtime' | 'reviewed';
}

interface QuizInterfaceProps {
  config: QuizConfig;
  onBack: () => void;
}

const QuizInterface = ({ config, onBack }: QuizInterfaceProps) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);

  const generateQuestion = async () => {
    setLoading(true);
    try {
      if (config.type === 'realtime') {
        // Generate AI question
        const { data, error } = await supabase.functions.invoke('generate-ai-question', {
          body: {
            examType: config.examType,
            difficulty: config.difficulty,
            topic: config.topic,
            userId: (await supabase.auth.getUser()).data.user?.id
          }
        });

        if (error) throw error;
        
        if (data.disclaimer) {
          toast({ title: data.disclaimer, variant: "info" });
        }
        
        setCurrentQuestion(data.question);
      } else {
        // Get reviewed question
        const { data: questions, error } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_type', config.examType.toLowerCase() as any)
          .eq('difficulty_level', config.difficulty.toLowerCase() as any)
          .ilike('topic', `%${config.topic}%`)
          .eq('status', 'approved')
          .limit(1)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (questions && questions.length > 0) {
          setCurrentQuestion(questions[0]);
        } else {
          toast({ title: 'No reviewed questions found for this topic. Try AI real-time questions instead.', variant: 'error' });
        }
      }
    } catch (error) {
      console.error('Error generating question:', error);
      toast({ title: 'Failed to generate question', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateQuestion();
  }, [config]);

  const handleAnswerSelect = (answer: string) => {
    if (showExplanation) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    const correct = selectedAnswer === currentQuestion.correct_answer;
    setIsCorrect(correct);
    setShowExplanation(true);

    // Save attempt to database
    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          question_id: currentQuestion.id,
          selected_answer: selectedAnswer,
          is_correct: correct
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving attempt:', error);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer('');
    setShowExplanation(false);
    setIsCorrect(null);
    setQuestionCount(prev => prev + 1);
    generateQuestion();
  };

  if (loading || !currentQuestion) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Generating your question...</p>
        </div>
      </Card>
    );
  }

  const options = [
    { key: 'A', text: currentQuestion.option_a },
    { key: 'B', text: currentQuestion.option_b },
    { key: 'C', text: currentQuestion.option_c },
    { key: 'D', text: currentQuestion.option_d }
  ];

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <div className="text-sm text-muted-foreground">
            Question {questionCount}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.type === 'realtime' ? 'secondary' : 'default'}>
            {config.examType}
          </Badge>
          <Badge variant="outline">{config.difficulty}</Badge>
          <MarkForReviewButton currentQuestionId={currentQuestion.id} source={config.type === 'realtime' ? 'ai' : 'reviewed'} />
        </div>
      </div>

      {/* Question Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Question */}
          <div>
            <h2 className="text-lg font-medium mb-4">
              {currentQuestion.question_text}
            </h2>
            
            {currentQuestion.is_ai_generated && (
            <Badge variant="outline" className="text-warning border-warning mb-4">
              AI Generated {currentQuestion.reviewed_by ? '• Guru Reviewed' : '• Not Reviewed'}
            </Badge>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {options.map((option) => {
              let buttonVariant: 'outline' | 'default' | 'destructive' | 'secondary' | 'ghost' | 'link' = 'outline';
              let icon = null;

              if (showExplanation) {
                if (option.key === currentQuestion.correct_answer) {
                  buttonVariant = 'default';
                  icon = <CheckCircle className="w-4 h-4 text-success" />;
                } else if (option.key === selectedAnswer && selectedAnswer !== currentQuestion.correct_answer) {
                  buttonVariant = 'destructive';
                  icon = <XCircle className="w-4 h-4 text-destructive" />;
                }
              } else if (option.key === selectedAnswer) {
                buttonVariant = 'secondary';
              }

              return (
                <Button
                  key={option.key}
                  variant={buttonVariant}
                  className="w-full justify-start text-left h-auto p-4"
                  onClick={() => handleAnswerSelect(option.key)}
                  disabled={showExplanation}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-medium">{option.key}.</span>
                    <span className="flex-1">{option.text}</span>
                    {icon}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!showExplanation && (
            <Button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer}
              className="w-full"
              size="lg"
            >
              Submit Answer
            </Button>
          )}

          {/* Explanation */}
          {showExplanation && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${isCorrect ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                   <CheckCircle className="w-5 h-5 text-success" />
                 ) : (
                   <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <span className="font-medium">
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                <p className="text-sm">
                  The correct answer is <strong>{currentQuestion.correct_answer}</strong>.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Explanation:</h4>
                <p className="text-sm">{currentQuestion.explanation}</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleNextQuestion} className="flex-1">
                  Next Question
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={onBack}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Change Topic
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QuizInterface;