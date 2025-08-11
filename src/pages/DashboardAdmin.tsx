import { useEffect, useState, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
const TrustpilotAnalytics = lazy(() => import("@/components/admin/TrustpilotAnalytics"));
const DashboardAdmin = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = "Admin Dashboard | EMGurus"; }, []);
  const { hash } = useLocation();
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    if (hash === "#blogs-admin" || hash === "#blogs-admin-section") {
      document.getElementById("blogs-admin-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash]);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Approve Gurus</h2>
          <p className="text-muted-foreground mb-4">Verify and onboard new mentors.</p>
          <Button onClick={() => navigate('/admin/approve-gurus')}>Open Approvals</Button>
        </Card>
        <section id="blogs-admin-section">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-2">Blogs (Admin)</h2>
            <p className="text-muted-foreground mb-4">Review drafts and publish when ready.</p>
            <Button onClick={() => navigate('/admin/moderate-posts')}>Moderate</Button>
          </Card>
        </section>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Exams</h2>
          <p className="text-muted-foreground mb-4">Generate and assign AI questions.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/admin/exams-curation#generator')}>Generator</Button>
            <Button variant="outline" onClick={() => navigate('/admin/exams-curation#assignments')}>Assignments</Button>
          </div>
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
        <div className="md:col-span-2 space-y-4">
          <Card className="p-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Trustpilot Analytics</h2>
            <Button variant="outline" onClick={() => setShowAnalytics((v) => !v)}>
              {showAnalytics ? 'Hide' : 'Load'}
            </Button>
          </Card>
          {showAnalytics && (
            <Suspense fallback={<p className="text-muted-foreground">Loading analytics…</p>}>
              <TrustpilotAnalytics />
            </Suspense>
          )}
        </div>
      </div>
    </main>
  );
};

export default DashboardAdmin;
