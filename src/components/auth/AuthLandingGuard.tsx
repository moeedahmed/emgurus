import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Lightweight global auth transition handler. Does not render anything.
const AuthLandingGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Only redirect away from the auth page to prevent navigation races
        if (location.pathname === "/auth") {
          navigate("/dashboard", { replace: true });
        }
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [navigate, location.pathname]);

  return null;
};

export default AuthLandingGuard;
