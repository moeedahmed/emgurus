import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate, useLocation } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DashboardGuru = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user, session } = useAuth();
  const [hasSlots, setHasSlots] = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(true);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<Array<{ id?: string; date?: string | null; start_time: string; end_time: string; is_available: boolean }>>([]);
  const [newException, setNewException] = useState<{ date: string; start: string; end: string; available: boolean }>({ date: "", start: "10:00", end: "12:00", available: true });
  const [weekly, setWeekly] = useState<Array<{ id?: string; day_of_week?: number | null; start_time: string; end_time: string }>>([]);
  const [newWeekly, setNewWeekly] = useState<{ dow: number; start: string; end: string }>({ dow: 1, start: "10:00", end: "14:00" });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";

  useEffect(() => {
    document.title = "Consultation Dashboard | EMGurus";
    // SEO
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Consultation tools: review blogs, review exam questions, and manage availability.");
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

  // Load timezone and availability (weekly + exceptions)
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data: prof } = await supabase.from('profiles').select('timezone').eq('user_id', user.id).maybeSingle();
        setTimezone(prof?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Weekly defaults
        const { data: weeklyRows } = await supabase
          .from('consult_availability')
          .select('id, day_of_week, start_time, end_time')
          .eq('guru_id', user.id)
          .eq('type', 'default')
          .order('day_of_week', { ascending: true });
        setWeekly((weeklyRows || []) as any);

        // Exceptions next 60 days
        const from = new Date();
        const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        const { data: exRows } = await supabase
          .from('consult_availability')
          .select('id, date, start_time, end_time, is_available')
          .eq('guru_id', user.id)
          .eq('type', 'exception')
          .gte('date', fromStr)
          .lte('date', toStr)
          .order('date', { ascending: true });
        setExceptions((exRows || []) as any);
      } catch (e) {
        console.warn('Failed to load availability snapshot', e);
      }
    })();
  }, [user?.id]);

  const addWeekly = async () => {
    if (!session) return toast({ title: 'Sign in required' });
    const { dow, start, end } = newWeekly;
    if (!start || !end || start >= end) return toast({ title: 'Invalid time range' });
    try {
      const res = await fetch(`${SUPABASE_EDGE}/api/guru/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'default', day_of_week: dow, start_time: start, end_time: end, is_available: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setWeekly((w) => [...w, json.availability]);
      setHasSlots(true);
      toast({ title: 'Weekly slot added' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not add weekly slot' });
    }
  };

  const addException = async () => {
    if (!session) return toast({ title: 'Sign in required' });
    const { date, start, end, available } = newException;
    if (!date || !start || !end || start >= end) return toast({ title: 'Invalid range' });
    try {
      const res = await fetch(`${SUPABASE_EDGE}/api/guru/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'exception', date, start_time: start, end_time: end, is_available: available }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setExceptions((x) => [...x, json.availability]);
      setHasSlots(true);
      toast({ title: available ? 'Added one-time availability' : 'Blocked time' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not add custom slot' });
    }
  };

  const deleteAvail = async (id?: string) => {
    if (!user || !id) return;
    try {
      const { error } = await supabase.from('consult_availability').delete().eq('id', id).eq('guru_id', user.id);
      if (error) throw error;
      setWeekly((w) => w.filter((x) => x.id !== id));
      setExceptions((x) => x.filter((e) => e.id !== id));
      toast({ title: 'Removed' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Delete failed' });
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Consultation Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <section id="blogs-section">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-2">Blogs</h2>
            <p className="text-muted-foreground mb-4">Write and review blogs.</p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => navigate('/admin/moderate-posts?view=reviewer&tab=pending')}>Pending Reviews</Button>
              <Button variant="outline" onClick={() => navigate('/admin/moderate-posts?view=reviewer&tab=completed')}>Completed Reviews</Button>
              <Button variant="secondary" onClick={() => navigate('/blogs/dashboard')}>My Blogs</Button>
            </div>
          </Card>
        </section>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Review Center</h2>
          <p className="text-muted-foreground mb-4">AI/peer-submitted questions assigned to you.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/guru/exams/review')}>Review pending</Button>
            <Button variant="outline" onClick={() => navigate('/guru/reviewed')}>Review completed</Button>
            <Button variant="secondary" onClick={() => navigate('/guru/questions')}>My questions</Button>
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

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Track Progress</h2>
          <p className="text-muted-foreground mb-4">Review your exam attempts and strengths.</p>
          <Button variant="secondary" onClick={() => navigate('/dashboard/user/progress')}>Open Progress</Button>
        </Card>
      </div>
    </main>
  );
};

export default DashboardGuru;
