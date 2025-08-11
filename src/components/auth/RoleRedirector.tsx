import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

const RoleRedirector = () => {
  const { user } = useAuth();
  const { roles } = useRoles();
  if (!user) return <Navigate to="/auth" replace />;
  if (roles.includes("admin")) return <Navigate to="/dashboard/admin" replace />;
  if (roles.includes("guru")) return <Navigate to="/dashboard/guru" replace />;
  return <Navigate to="/dashboard/user" replace />;
};

export default RoleRedirector;
