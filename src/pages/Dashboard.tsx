import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Dashboard | EMGurus";
  }, []);

  useEffect(() => {
    const routeByRole = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        if (error) throw error;
        const roles = (data || []).map((r: any) => r.role);
        if (roles.includes('admin')) return navigate('/dashboard/admin', { replace: true });
        if (roles.includes('guru')) return navigate('/dashboard/guru', { replace: true });
        // Default to user dashboard
        return navigate('/dashboard/user', { replace: true });
      } catch (e) {
        console.error('Failed to resolve role', e);
        navigate('/dashboard/user', { replace: true });
      }
    };
    routeByRole();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
    </div>
  );
};

export default Dashboard;
