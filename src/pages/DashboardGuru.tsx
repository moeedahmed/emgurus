import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DashboardGuru = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user } = useAuth();
  const [hasSlots, setHasSlots] = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        setCheckingAvail(true);
        const { count, error } = await (supabase as any)
          .from('consult_availability')
          .select('id', { count: 'exact', head: true })
          .eq('guru_id', user.id)
          .eq('is_available', true);
        if (error) throw error;
        if (!cancelled) setHasSlots((count ?? 0) > 0);
      } catch {
        if (!cancelled) setHasSlots(false);
      } finally {
        if (!cancelled) setCheckingAvail(false);
      }
    })();
    return () => { cancelled = true };
  }, [user?.id]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Guru Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Blogs</h2>
          <p className="text-muted-foreground mb-4">Write and review blogs.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/admin/moderate-posts')}>Review Pending</Button>
            <Button variant="outline" onClick={() => navigate('/blogs')}>Review Completed</Button>
            <Button variant="secondary" onClick={() => navigate('/blogs')}>My Blogs</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Review Questions</h2>
          <p className="text-muted-foreground mb-4">AI/peer-submitted questions assigned to you.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/guru/reviews')}>Review Pending</Button>
            <Button variant="outline" onClick={() => navigate('/guru/reviewed')}>Review Completed</Button>
            <Button variant="secondary" onClick={() => navigate('/guru/questions')}>My Questions</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Availability & Rate</h2>
          <p className="text-muted-foreground mb-4">Control your visibility in Consultations.</p>
          <div className="flex items-center gap-3 mb-2">
            <Switch
              id="not-available"
              checked={!hasSlots}
              disabled={checkingAvail}
              onCheckedChange={(checked) => {
                // checked = Not available
                if (!checked) {
                  // Switching to Available
                  if (!hasSlots) {
                    toast({ title: 'Set your schedule', description: 'Add availability slots to appear in Consultations.' });
                    navigate('/guru/availability');
                    return;
                  }
                  setHasSlots(true);
                } else {
                  setHasSlots(false);
                }
              }}
            />
            <Label htmlFor="not-available">Not available</Label>
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            Status: <span className="font-medium">{!hasSlots ? 'Hidden from Consultations' : 'Visible in Consultations'}</span>
          </div>
          <div className="text-sm text-muted-foreground mb-4">Current rate: <span className="font-medium">Free</span> (default if not set)</div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/guru/availability')}>Set availability</Button>
            <Button variant="outline" onClick={() => navigate('/profile#pricing')}>Set price</Button>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default DashboardGuru;
