import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReportCard } from '@/components/exams/ReportCard';

interface ExamReportState {
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
}

export default function ExamReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const reportData = location.state as ExamReportState | null;

  useEffect(() => {
    document.title = "Exam Results • EM Gurus";
  }, []);

  // Redirect if no report data
  useEffect(() => {
    if (!reportData) {
      navigate('/exams', { replace: true });
    }
  }, [reportData, navigate]);

  if (!reportData) {
    return null; // Will redirect
  }

  const handleRetake = () => {
    navigate('/exams/exam');
  };

  const handleViewAttempts = () => {
    navigate('/dashboard/user#exams-attempts');
  };

  const handleBackToExams = () => {
    navigate('/exams');
  };

  return (
    <ReportCard
      attemptId={reportData.attemptId}
      score={reportData.score}
      duration={reportData.duration}
      exam={reportData.exam}
      onRetake={handleRetake}
      onViewAttempts={handleViewAttempts}
      onBackToExams={handleBackToExams}
    />
  );
}