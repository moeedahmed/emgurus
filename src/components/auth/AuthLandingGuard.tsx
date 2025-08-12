import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Lightweight global auth transition handler. Does not render anything.
const AuthLandingGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        // Only redirect away from the auth page to prevent navigation races
        if (location.pathname === "/auth") {
          try {
            const { data } = await supabase.from('profiles').select('full_name, country, timezone, specialty, primary_specialty, exams, exam_interests, languages, onboarding_required').maybeSingle();
            const missing = !data?.full_name || !data?.country || !data?.timezone || !((data?.primary_specialty || data?.specialty)) || !(((data?.exam_interests || data?.exams) as any[])?.length) || !(((data?.languages) as any[])?.length);
            if (missing || data?.onboarding_required) {
              navigate("/profile", { replace: true });
            } else {
              navigate("/dashboard", { replace: true });
            }
          } catch {
            navigate("/profile", { replace: true });
          }
        }
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [navigate, location.pathname]);

  return null;
};

export default AuthLandingGuard;
