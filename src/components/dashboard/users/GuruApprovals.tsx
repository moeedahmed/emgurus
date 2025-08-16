import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function GuruApprovals() {
  const { user, loading: userLoading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading applications…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to view applications.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from('guru_applications')
          .select('id, user_id, specialties, experience, motivation, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchApplications();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleApprove = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('guru_applications')
        .update({ status: 'approved' })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: "Application Approved",
        description: "The guru application has been approved.",
      });

      // Refresh the list
      setRows(prev => prev.filter(row => row.id !== applicationId));
    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: "Approval Failed",
        description: "Unable to approve application. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('guru_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: "Application Rejected",
        description: "The guru application has been rejected.",
      });

      // Refresh the list
      setRows(prev => prev.filter(row => row.id !== applicationId));
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: "Rejection Failed",
        description: "Unable to reject application. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="p-4">Loading applications...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-2 text-sm text-muted-foreground">Guru applications awaiting approval.</div>
      <TableCard
        title="Pending Applications"
        columns={[
          { key: 'user_id', header: 'User ID' },
          { 
            key: 'specialties', 
            header: 'Specialties', 
            render: (r: any) => (r.specialties || []).join(', ').slice(0, 50) 
          },
          { key: 'experience', header: 'Experience' },
          { key: 'created_at', header: 'Applied', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
          { 
            key: 'actions', 
            header: 'Actions', 
            render: (r: any) => (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleApprove(r.id)}
                >
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleReject(r.id)}
                >
                  Reject
                </Button>
              </div>
            )
          },
        ]}
        rows={rows}
        emptyText="No pending applications."
      />
    </div>
  );
}