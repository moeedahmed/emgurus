import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

// Restricts access to users having at least one of the required roles
const RoleProtectedRoute: React.FC<{ roles: Array<"admin" | "guru" | "user">; children: React.ReactNode }>
= ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user) { setAllowed(false); return; }
      // Use shared role loader
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const rolesHook = (useRoles as any)();
      const userRoles: string[] = rolesHook?.roles || [];
      setAllowed(userRoles.some((r) => roles.includes(r as any)));
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  if (loading || allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
