import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

const RoleRedirector = () => {
  const { user } = useAuth();
  const { roles, isLoading } = useRoles();
  if (!user) return <Navigate to="/auth" replace />;
  if (isLoading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  if (roles.includes("admin")) return <Navigate to="/dashboard/admin" replace />;
  if (roles.includes("guru")) return <Navigate to="/dashboard/guru" replace />;
  return <Navigate to="/profile" replace />;
};

export default RoleRedirector;
