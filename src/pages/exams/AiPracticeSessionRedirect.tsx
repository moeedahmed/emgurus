import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AiPracticeSessionRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  useEffect(() => {
    const handleRedirect = async () => {
      // Get query params from old URL
      const exam = searchParams.get("exam");
      const topic = searchParams.get("topic");
      const difficulty = searchParams.get("difficulty") || "medium";
      const count = searchParams.get("count") || "10";

      if (!exam) {
        navigate('/exams/ai-practice');
        return;
      }

      try {
        // Check auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate(`/auth?returnTo=${encodeURIComponent('/exams/ai-practice')}`);
          return;
        }

        // Create AI exam session
        const { data: session, error: sessionError } = await supabase
          .from('ai_exam_sessions')
          .insert({
            user_id: user.id,
            exam_type: exam.replace(/\s+/g, '_').replace(/\+/g, '_').toUpperCase() as any
          })
          .select('id')
          .single();
          
        if (sessionError) throw sessionError;

        // Navigate to new session URL
        const params = new URLSearchParams();
        params.set('exam', exam);
        params.set('count', count);
        if (topic && topic !== 'All areas') params.set('topic', topic);
        params.set('difficulty', difficulty);
        navigate(`/exams/ai-practice/session/${session.id}?${params.toString()}`, { replace: true });
      } catch (err: any) {
        console.error('Session creation failed', err);
        toast({
          title: "Session creation failed",
          description: err?.message || "Please try again",
          variant: 'destructive'
        });
        navigate('/exams/ai-practice');
      }
    };

    handleRedirect();
  }, [navigate, searchParams, toast]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}