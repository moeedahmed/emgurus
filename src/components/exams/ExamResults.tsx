import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Clock, Target } from 'lucide-react';

interface ExamResultsProps {
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  duration: number;
  timeLimit: number;
  onContinue: () => void;
  onRetakeExam?: () => void;
}

export default function ExamResults({ score, duration, timeLimit, onContinue, onRetakeExam }: ExamResultsProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 80) return { variant: 'default' as const, text: 'Excellent', icon: CheckCircle };
    if (percentage >= 60) return { variant: 'secondary' as const, text: 'Good', icon: Target };
    return { variant: 'destructive' as const, text: 'Needs Work', icon: XCircle };
  };

  const badge = getScoreBadge(score.percentage);
  const BadgeIcon = badge.icon;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Exam Complete!</CardTitle>
          <p className="text-muted-foreground">Here's how you performed</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Overview */}
          <div className="text-center space-y-4">
            <div className={`text-6xl font-bold ${getScoreColor(score.percentage)}`}>
              {score.percentage}%
            </div>
            <Badge variant={badge.variant} className="text-sm px-3 py-1">
              <BadgeIcon className="h-4 w-4 mr-1" />
              {badge.text}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Score Progress</span>
              <span>{score.correct} / {score.total} correct</span>
            </div>
            <Progress value={score.percentage} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{score.correct}</div>
                <div className="text-sm text-muted-foreground">Correct Answers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{score.total - score.correct}</div>
                <div className="text-sm text-muted-foreground">Incorrect Answers</div>
              </CardContent>
            </Card>
          </div>

          {/* Time Stats */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Time Used: {formatTime(duration)}</span>
            </div>
            <span>•</span>
            <span>Time Limit: {formatTime(timeLimit)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={onContinue} className="flex-1">
              View All Attempts
            </Button>
            {onRetakeExam && (
              <Button variant="outline" onClick={onRetakeExam} className="flex-1">
                Retake Exam
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}