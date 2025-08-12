import { useEffect } from "react";
import { useRoles } from "@/hooks/useRoles";
import { useNavigate } from "react-router-dom";

export default function BlogsDashboard() {
  const { roles } = useRoles();
  const navigate = useNavigate();
  useEffect(() => {
    const target = roles.includes('admin') ? '/dashboard/admin#blogs' : roles.includes('guru') ? '/dashboard/guru#blogs' : '/dashboard/user#blogs';
    navigate(target, { replace: true });
  }, [roles]);
  return null;
}
