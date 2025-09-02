import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Clock, 
  Target, 
  RotateCcw, 
  History, 
  ArrowLeft,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface ReportCardProps {
  attemptId: string;
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  duration: {
    seconds: number;
    formatted: string;
  };
  exam: {
    name: string;
    topic?: string;
  };
  breakdown?: {
    topic: string;
    correct: number;
    total: number;
  }[];
  onRetake?: () => void;
  onViewAttempts?: () => void;
  onBackToExams?: () => void;
}

export function ReportCard({
  attemptId,
  score,
  duration,
  exam,
  breakdown = [],
  onRetake,
  onViewAttempts,
  onBackToExams
}: ReportCardProps) {
  const navigate = useNavigate();

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 80) return { variant: 'default' as const, text: 'Excellent', icon: Trophy };
    if (percentage >= 60) return { variant: 'secondary' as const, text: 'Good', icon: CheckCircle2 };
    return { variant: 'destructive' as const, text: 'Needs Practice', icon: XCircle };
  };

  const scoreBadge = getScoreBadge(score.percentage);
  const BadgeIcon = scoreBadge.icon;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-6">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Exam Complete!
          </CardTitle>
          <div className="text-muted-foreground">
            {exam.name}{exam.topic && ` • ${exam.topic}`}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Score Overview */}
          <div className="text-center space-y-4">
            <div className={`text-6xl font-bold ${getScoreColor(score.percentage)}`}>
              {score.percentage}%
            </div>
            <div className="text-lg text-muted-foreground">
              {score.correct} out of {score.total} questions correct
            </div>
            <Badge variant={scoreBadge.variant} className="text-base px-4 py-2">
              <BadgeIcon className="h-4 w-4 mr-2" />
              {scoreBadge.text}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{score.correct}/{score.total}</span>
            </div>
            <Progress value={score.percentage} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Time Taken</span>
                </div>
                <div className="text-2xl font-bold">{duration.formatted}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Accuracy</span>
                </div>
                <div className="text-2xl font-bold">{score.percentage}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Topic Breakdown */}
          {breakdown.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Performance by Topic</h3>
              {breakdown.map((topic, index) => {
                const topicPercentage = Math.round((topic.correct / topic.total) * 100);
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{topic.topic}</span>
                      <span>{topic.correct}/{topic.total} ({topicPercentage}%)</span>
                    </div>
                    <Progress value={topicPercentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          onClick={onRetake || (() => navigate('/exams/exam'))}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Retake Exam
        </Button>
        
        <Button 
          variant="outline"
          onClick={onViewAttempts || (() => navigate('/dashboard/user#exams-attempts'))}
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          View All Attempts
        </Button>
        
        <Button 
          variant="outline"
          onClick={onBackToExams || (() => navigate('/exams'))}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exams
        </Button>
      </div>
    </div>
  );
}

export default ReportCard;