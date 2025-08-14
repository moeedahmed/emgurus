import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

// Restricts access to users having at least one of the required roles
const RoleProtectedRoute: React.FC<{ roles: Array<"admin" | "guru" | "user">; children: React.ReactNode }>
= ({ roles, children }) => {
  const { user, loading, authReady } = useAuth();
  const location = useLocation();
  // IMPORTANT: call hooks at top-level (no hooks in effects)
  const { roles: userRoles, isLoading } = useRoles();

  const isAllowed = !!user && userRoles.some((r) => roles.includes(r));

  // Wait for auth to be ready before making routing decisions
  if (loading || authReady !== 'ready' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    // If unauthenticated, send to auth; otherwise to home
    return <Navigate to={user ? '/' : '/auth'} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
