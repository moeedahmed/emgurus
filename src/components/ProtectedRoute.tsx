import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setChecking(false); return; }
      // Skip check on profile route to avoid redirect loop
      if (location.pathname.startsWith('/profile')) { setChecking(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, country, specialty, timezone, exams, onboarding_required')
        .eq('user_id', user.id)
        .maybeSingle();
      const missing = !data?.full_name || !data?.country || !data?.specialty || !data?.timezone || !(data?.exams && (data.exams as any[]).length > 0);
      // Only force redirect if the flag explicitly requires onboarding
      setNeedsOnboarding(!!data?.onboarding_required && missing);
      setChecking(false);
    })();
  }, [user, location.pathname]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (needsOnboarding && !location.pathname.startsWith('/settings')) {
    return <Navigate to="/settings#profile" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
