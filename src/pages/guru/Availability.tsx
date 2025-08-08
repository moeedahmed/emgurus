import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";

type Avail = {
  id?: string;
  type: "default" | "exception";
  day_of_week?: number | null;
  date?: string | null; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  is_available: boolean;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function GuruAvailability() {
  const { session } = useAuth();
  const [timezone, setTimezone] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<Avail[]>([]);
  const [exceptions, setExceptions] = useState<Avail[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state for adding ranges
  const [newWeekly, setNewWeekly] = useState<{ dow: number; start: string; end: string }>({ dow: 1, start: "10:00", end: "14:00" });
  const [newException, setNewException] = useState<{ date: string; start: string; end: string; available: boolean }>({ date: "", start: "10:00", end: "12:00", available: true });

  useEffect(() => {
    document.title = "Manage Availability | EMGurus";
    // meta description
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "Guru dashboard to manage weekly and custom availability for consultations.");
    // canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.href;
  }, []);

  // Load profile timezone and current availability
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const user = session?.user;
        if (!user) return;
        const { data: prof } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle();
        setTimezone(prof?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Weekly defaults
        const { data: weeklyRows } = await supabase
          .from("consult_availability")
          .select("id, type, day_of_week, start_time, end_time, is_available")
          .eq("type", "default")
          .eq("guru_id", user.id)
          .order("day_of_week", { ascending: true });
        setWeekly((weeklyRows || []) as any);

        // Exceptions for next 60 days
        const from = new Date();
        const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        const { data: exceptionRows } = await supabase
          .from("consult_availability")
          .select("id, type, date, start_time, end_time, is_available")
          .eq("type", "exception")
          .eq("guru_id", user.id)
          .gte("date", fromStr)
          .lte("date", toStr)
          .order("date", { ascending: true });
        setExceptions((exceptionRows || []) as any);
      } catch (e) {
        console.error(e);
        toast({ title: "Failed to load availability" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session?.user?.id]);

  const addWeekly = async () => {
    if (!session) return toast({ title: "Sign in required" });
    const { dow, start, end } = newWeekly;
    if (!start || !end || start >= end) return toast({ title: "Invalid time range", description: "Start must be before end." });
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_EDGE}/api/guru/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: "default", day_of_week: dow, start_time: start, end_time: end, is_available: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setWeekly((w) => [...w, json.availability]);
      toast({ title: "Weekly slot added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Could not add weekly slot" });
    } finally {
      setLoading(false);
    }
  };

  const deleteAvail = async (id?: string) => {
    if (!session || !id) return;
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_EDGE}/api/guru/availability/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setWeekly((w) => w.filter((x) => x.id !== id));
      setExceptions((w) => w.filter((x) => x.id !== id));
      toast({ title: "Removed" });
    } catch (e) {
      console.error(e);
      toast({ title: "Delete failed" });
    } finally {
      setLoading(false);
    }
  };

  const addException = async () => {
    if (!session) return toast({ title: "Sign in required" });
    const { date, start, end, available } = newException;
    if (!date || !start || !end || start >= end) return toast({ title: "Invalid range" });
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_EDGE}/api/guru/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: "exception", date, start_time: start, end_time: end, is_available: available }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setExceptions((x) => [...x, json.availability]);
      toast({ title: available ? "Added one-time availability" : "Blocked time" });
    } catch (e) {
      console.error(e);
      toast({ title: "Could not add custom slot" });
    } finally {
      setLoading(false);
    }
  };

  const weeklyByDay = useMemo(() => {
    const by: Record<number, Avail[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const w of weekly) {
      if (w.day_of_week !== null && w.day_of_week !== undefined) by[w.day_of_week] = [...(by[w.day_of_week] || []), w];
    }
    return by;
  }, [weekly]);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">My Availability</h1>
        <p className="text-muted-foreground">Timezone: {timezone || "Loading..."}</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Weekly recurring</h2>
          <div className="grid gap-3">
            {Object.entries(weeklyByDay).map(([d, slots]) => (
              <div key={d} className="rounded border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{dayNames[Number(d)]}</div>
                  <div className="text-xs text-muted-foreground">{slots.length} range{slots.length === 1 ? "" : "s"}</div>
                </div>
                {slots.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No ranges</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-sm">
                        <span>{s.start_time}–{s.end_time}</span>
                        <Button size="sm" variant="ghost" onClick={() => deleteAvail(s.id)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator className="my-4" />
          <div className="grid gap-2 md:grid-cols-4 items-end">
            <div>
              <Label>Day</Label>
              <select className="w-full rounded-md border bg-background p-2" value={newWeekly.dow} onChange={(e) => setNewWeekly({ ...newWeekly, dow: Number(e.target.value) })}>
                {dayNames.map((n, i) => (<option key={i} value={i}>{n}</option>))}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newWeekly.start} onChange={(e) => setNewWeekly({ ...newWeekly, start: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newWeekly.end} onChange={(e) => setNewWeekly({ ...newWeekly, end: e.target.value })} />
            </div>
            <Button onClick={addWeekly} disabled={loading}>Add range</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Custom availability / time off</h2>
          <div className="grid gap-2 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <Label>Date</Label>
              <Input type="date" value={newException.date} onChange={(e) => setNewException({ ...newException, date: e.target.value })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newException.start} onChange={(e) => setNewException({ ...newException, start: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newException.end} onChange={(e) => setNewException({ ...newException, end: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full rounded-md border bg-background p-2" value={newException.available ? "available" : "blocked"} onChange={(e) => setNewException({ ...newException, available: e.target.value === "available" })}>
                <option value="available">Available</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <Button className="md:col-span-5" onClick={addException} disabled={loading}>Add</Button>
          </div>

          <Separator className="my-4" />
          <div className="space-y-2">
            {exceptions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No upcoming custom entries</div>
            ) : (
              exceptions.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded border p-2">
                  <div className="text-sm">
                    <span className="font-medium">{e.date}</span> • {e.start_time}–{e.end_time} • {e.is_available ? "Available" : "Blocked"}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteAvail(e.id)}>Remove</Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
