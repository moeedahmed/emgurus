import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
const DashboardAdmin = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Admin Dashboard | EMGurus";
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const ran = localStorage.getItem('emg_seed_users_done');
        if (ran) return;
        const { error } = await supabase.functions.invoke('seed-test-users');
        if (error) throw error;
        toast.success('Seeded test users and roles');
        localStorage.setItem('emg_seed_users_done', '1');
      } catch (e) {
        console.error('Seeding failed', e);
      }
    };
    run();
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Approve Gurus</h2>
          <p className="text-muted-foreground mb-4">Verify and onboard new mentors.</p>
          <Button variant="secondary" onClick={() => navigate('/admin/approve-gurus')}>Open Approvals</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Moderate Blog Posts</h2>
          <p className="text-muted-foreground mb-4">Review drafts and publish when ready.</p>
          <Button variant="secondary" onClick={() => navigate('/admin/moderate-posts')}>Moderate</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Assign AI Question Reviews</h2>
          <p className="text-muted-foreground mb-4">Distribute review tasks to Gurus.</p>
          <Button variant="secondary" onClick={() => navigate('/admin/assign-reviews')}>Assign</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Manage Categories & Tags</h2>
          <p className="text-muted-foreground mb-4">Maintain taxonomy across the platform.</p>
          <Button variant="secondary" onClick={() => navigate('/admin/taxonomy')}>Manage</Button>
        </Card>
      </div>
    </main>
  );
};

export default DashboardAdmin;
