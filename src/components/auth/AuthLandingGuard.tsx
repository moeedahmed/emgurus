import React from "react";
import { useAuth } from "@/contexts/AuthContext";

// Disabled: AuthLandingGuard now reads from AuthContext instead of having its own listener
// This prevents duplicate auth state listeners and navigation races
const AuthLandingGuard = () => {
  // This component is now a no-op since AuthContext handles auth state changes
  // and RoleRedirector handles post-login navigation
  return null;
};

export default AuthLandingGuard;
