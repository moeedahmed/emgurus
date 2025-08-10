import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

// Restricts access to users having at least one of the required roles
const RoleProtectedRoute: React.FC<{ roles: Array<"admin" | "guru" | "user">; children: React.ReactNode }>
= ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // IMPORTANT: call hooks at top-level (no hooks in effects)
  const { roles: userRoles, isLoading } = useRoles();

  const isAllowed = !!user && userRoles.some((r) => roles.includes(r));

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    // redirect to dashboard (or home) with return location
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
