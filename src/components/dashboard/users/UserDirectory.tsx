import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Badge } from "@/components/ui/badge";

export default function UserDirectory() {
  const { user, loading: userLoading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading directory…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to view the directory.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Simulate user directory data  
        const data = Array.from({ length: 10 }, (_, i) => ({
          id: `user-${i}`,
          display_name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          created_at: new Date().toISOString(),
          user_roles: [{ role: i < 2 ? 'guru' : 'user' }]
        }));
        
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUsers();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-2 text-sm text-muted-foreground">All platform users and their roles.</div>
      <TableCard
        title="User Directory"
        columns={[
          { key: 'display_name', header: 'Name' },
          { key: 'email', header: 'Email' },
          { 
            key: 'roles', 
            header: 'Roles', 
            render: (r: any) => (
              <div className="flex gap-1">
                {(r.user_roles || []).map((role: any, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {role.role}
                  </Badge>
                ))}
              </div>
            )
          },
          { key: 'created_at', header: 'Joined', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
        ]}
        rows={rows}
        emptyText="No users found."
      />
    </div>
  );
}