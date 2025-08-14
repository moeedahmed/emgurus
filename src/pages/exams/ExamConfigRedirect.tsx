import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ExamConfigRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect legacy /exams/exam to /exams/test
    navigate('/exams/test', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}