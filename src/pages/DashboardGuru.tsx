import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

const DashboardGuru = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    document.title = "Guru Dashboard | EMGurus";
    // SEO
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Guru tools: review blogs, review exam questions, and manage availability.");
    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = `${window.location.origin}/dashboard/guru`;
  }, []);

  useEffect(() => {
    if (hash === "#blogs" || hash === "#blogs-section") {
      document.getElementById("blogs-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Guru Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Review Blogs</h2>
          <p className="text-muted-foreground mb-4">Blog posts submitted by users or forwarded by admins.</p>
          <Button onClick={() => document.getElementById('blogs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Go to Blogs</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Review Questions</h2>
          <p className="text-muted-foreground mb-4">AI/peer-submitted questions assigned to you.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/guru/reviews')}>Review Queue</Button>
            <Button variant="outline" onClick={() => navigate('/guru/reviewed')}>Reviewed by Me</Button>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Define Availability & Rate</h2>
          <p className="text-muted-foreground mb-4">Set your schedule and hourly rate.</p>
          <Button onClick={() => navigate('/guru/availability')}>Configure</Button>
        </Card>
      </div>

      <section id="blogs-section" className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Blogs</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-medium mb-2">My Posts</h3>
            <p className="text-sm text-muted-foreground mb-4">Draft and submitted posts authored by you.</p>
            <Button onClick={() => navigate('/editor')}>Open Editor</Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-medium mb-2">Review Queue</h3>
            <p className="text-sm text-muted-foreground mb-4">Posts awaiting guru review.</p>
            <Button onClick={() => navigate('/admin/moderate-posts')}>Open Review</Button>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default DashboardGuru;
