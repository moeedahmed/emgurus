import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TrustpilotAnalytics from "@/components/admin/TrustpilotAnalytics";
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
          <Button onClick={() => navigate('/admin/approve-gurus')}>Open Approvals</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Moderate Blog Posts</h2>
          <p className="text-muted-foreground mb-4">Review drafts and publish when ready.</p>
          <Button onClick={() => navigate('/admin/moderate-posts')}>Moderate</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Assign AI Question Reviews</h2>
          <p className="text-muted-foreground mb-4">Distribute review tasks to Gurus.</p>
          <Button onClick={() => navigate('/admin/assign-reviews')}>Assign</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Manage Categories & Tags</h2>
          <p className="text-muted-foreground mb-4">Maintain taxonomy across the platform.</p>
          <Button onClick={() => navigate('/admin/taxonomy')}>Manage</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Import EMGurus Content</h2>
          <p className="text-muted-foreground mb-4">Fetch and publish from emgurus.com (admin/guru only).</p>
          <Button onClick={async () => {
            try {
              const { data, error } = await supabase.functions.invoke('import-emgurus', { body: { url: 'https://emgurus.com', limit: 30 } });
              if (error) throw error;
              toast.success(`Imported ${data?.imported || 0} articles`);
            } catch (e) {
              console.error(e);
              toast.error('Import failed. Ensure you are admin/guru and FIRECRAWL_API_KEY is set.');
            }
          }}>Run Import</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Add Sample Blog Posts</h2>
          <p className="text-muted-foreground mb-4">Create a few published examples to preview the blog.</p>
          <Button onClick={async () => {
            try {
              const titles = [
                'Managing Sepsis in the ED: A Practical Guide',
                'Airway Pearls: Intubation Tips for Difficult Cases',
                'ECG Mastery: Recognizing STEMI Mimics'
              ];
              const now = new Date().toISOString();
              const { data: userData } = await supabase.auth.getUser();
              const authorId = userData.user?.id as string;
              const rows = titles.map((t) => ({
                title: t,
                description: 'Sample article for preview of EMGurus blog layout.',
                cover_image_url: null,
                content: `<p>This is a <strong>sample article</strong> to demonstrate how content appears on EMGurus. Replace with real content via the importer.</p><p>Posted on ${now}</p>`,
                status: 'published' as const,
                slug: t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
                author_id: authorId,
              }));
              const { error } = await supabase.from('blog_posts').insert(rows);
              if (error) throw error;
              toast.success('Sample posts added');
            } catch (e) {
              console.error(e);
              toast.error('Failed to add sample posts');
            }
          }}>Add Samples</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Send Review Invites</h2>
          <p className="text-muted-foreground mb-4">Send post-onboarding (5 days) Trustpilot invitations.</p>
          <Button onClick={async () => {
            try {
              const { data, error } = await supabase.functions.invoke('send-review-invites');
              if (error) throw error;
              toast.success(`Invites sent: ${data?.sent ?? 0}`);
            } catch (e) {
              console.error(e);
              toast.error('Failed to send invites');
            }
          }}>Run Now</Button>
        </Card>
        <div className="md:col-span-2">
          <TrustpilotAnalytics />
        </div>
      </div>
    </main>
  );
};

export default DashboardAdmin;
