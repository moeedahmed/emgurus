import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Lightweight global auth transition handler. Does not render anything.
const AuthLandingGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Only push to dashboard if not already on a protected page to avoid loops
        const path = location.pathname;
        const isProtected = /^(\/dashboard|\/profile|\/bookings|\/guru|\/admin)/.test(path);
        if (!isProtected) navigate("/dashboard", { replace: true });
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [navigate]);

  return null;
};

export default AuthLandingGuard;
