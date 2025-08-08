import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GuruCard, type Guru } from "@/components/consultations/GuruCard";
import { BookingModal } from "@/components/consultations/BookingModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageHero from "@/components/PageHero";

const Consultations = () => {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [exam, setExam] = useState<string>("all");
  const [specialty, setSpecialty] = useState<string>("all");

  const [bookingGuru, setBookingGuru] = useState<Guru | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attemptedSeed, setAttemptedSeed] = useState(false);
  
  useEffect(() => {
    const title = "Book a Guru for Career Guidance | EMGurus";
    document.title = title;
    // meta description
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "Filter by specialty, country, or exam to find the right mentor. Book, view availability, and schedule.");
    // canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.href;
  }, []);

  // Fetch gurus from Edge Function
  const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";

  type ApiGuru = {
    user_id?: string; // primary id in API
    id?: string | null; // fallback, if API changes
    full_name?: string | null;
    name?: string | null;
    specialty?: string | null;
    country?: string | null;
    price_per_30min?: number | null;
    exams?: string[] | null;
    bio?: string | null;
    avatar_url?: string | null;
    timezone?: string | null;
  };
  const [gurus, setGurus] = useState<Guru[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${SUPABASE_EDGE}/api/gurus?bust=${Date.now()}` as string, { cache: 'no-store' as RequestCache });
        if (!res.ok) throw new Error("Failed to load gurus");
        const data = await res.json();
        const items: ApiGuru[] = data.items || data || [];
        const mapped: Guru[] = items.map((x) => ({
          id: (x.id || x.user_id) as string,
          full_name: x.full_name || x.name || "Guru",
          specialty: x.specialty || null,
          country: x.country || null,
          price_per_30min: x.price_per_30min ?? null,
          exams: x.exams || [],
          bio: x.bio || null,
          avatar_url: x.avatar_url || null,
          timezone: x.timezone || null,
        }));

        console.groupCollapsed('[Consultations] /api/gurus fetch');
        console.log('Fetched items:', items.length);
        console.log('Mapped gurus:', mapped.length, mapped.map(m => m.full_name));
        console.groupEnd();

        if (mapped.length) {
          setGurus(mapped);
        }

        // If fewer than 5 gurus loaded and we haven't tried seeding, try once and refetch
        if ((mapped.length < 5) && !attemptedSeed) {
          setAttemptedSeed(true);
          try {
            const { error } = await supabase.functions.invoke('seed-sample-gurus', { body: {} });
            if (error) console.warn('Seed function returned error:', error);
          } catch (seedErr) {
            console.error('Auto-seed failed', seedErr);
          }
          const res2 = await fetch(`${SUPABASE_EDGE}/api/gurus?bust=${Date.now()}` as string, { cache: 'no-store' as RequestCache });
          if (res2.ok) {
            const data2 = await res2.json();
            const items2: ApiGuru[] = data2.items || data2 || [];
            const mapped2: Guru[] = items2.map((x) => ({
              id: (x.id || x.user_id) as string,
              full_name: x.full_name || x.name || "Guru",
              specialty: x.specialty || null,
              country: x.country || null,
              price_per_30min: x.price_per_30min ?? null,
              exams: x.exams || [],
              bio: x.bio || null,
              avatar_url: x.avatar_url || null,
              timezone: x.timezone || null,
            }));
            console.groupCollapsed('[Consultations] post-seed /api/gurus fetch');
            console.log('Fetched items:', items2.length);
            console.log('Mapped gurus:', mapped2.length, mapped2.map(m => m.full_name));
            console.groupEnd();
            if (mapped2.length) {
              setGurus(mapped2);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptedSeed]);

  // Handle Stripe return (success/cancel) and verify booking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('payment');
    const sessionId = params.get('session_id');

    const clearParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    };

    if (flag === 'success' && sessionId) {
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error('Please sign in to verify your payment.');
          clearParams();
          return;
        }
        try {
          const res = await fetch(`${SUPABASE_EDGE}/api/payments/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ session_id: sessionId }),
          });
          if (!res.ok) throw new Error(await res.text());
          toast.success('Booking confirmed!');
        } catch (e) {
          console.error(e);
          toast.error('Payment verification failed.');
        } finally {
          clearParams();
        }
      })();
    } else if (flag === 'cancelled') {
      toast('Payment cancelled');
      clearParams();
    }
  }, []);

  const countries = useMemo(() => ["all", ...Array.from(new Set(gurus.map(g => g.country).filter(Boolean))) as string[]], [gurus]);
  const specialties = useMemo(() => ["all", ...Array.from(new Set(gurus.map(g => g.specialty).filter(Boolean))) as string[]], [gurus]);
  const exams = useMemo(() => ["all", ...Array.from(new Set(gurus.flatMap(g => g.exams || [])))], [gurus]);

  useEffect(() => {
    console.groupCollapsed('[Consultations] Derived filters');
    console.log('Countries:', countries);
    console.log('Specialties:', specialties);
    console.log('Exams:', exams);
    console.groupEnd();
  }, [countries, specialties, exams]);

  const filtered = useMemo(() => {
    return gurus.filter(g =>
      (country === "all" || g.country === country) &&
      (specialty === "all" || g.specialty === specialty) &&
      (exam === "all" || (g.exams || []).includes(exam)) &&
      (search.trim() === "" ||
        g.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (g.specialty || '').toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, country, exam, specialty, gurus]);

  return (
    <main className="container mx-auto px-4 py-8">
      <PageHero
        title="EM Gurus Consultations"
        subtitle="Filter by specialty, country, or exam to find the right mentor."
        align="left"
        ctas={[{ label: "How Consultations Work", href: "/coming-soon", variant: "outline" }]}
      />

      <section className="grid gap-4 md:grid-cols-4 mb-6">
        <Input placeholder="Search by name or specialty" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            {countries.map((c) => (<SelectItem key={c} value={c}>{c === "all" ? "All Countries" : c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger><SelectValue placeholder="Specialty" /></SelectTrigger>
          <SelectContent>
            {specialties.map((s) => (<SelectItem key={s} value={s}>{s === "all" ? "All Specialties" : s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={exam} onValueChange={setExam}>
          <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
          <SelectContent>
            {exams.map((e) => (<SelectItem key={e} value={e}>{e === "all" ? "All Exams" : e}</SelectItem>))}
          </SelectContent>
        </Select>
      </section>

      {filtered.length === 0 ? (
        <section className="text-center text-muted-foreground py-12">
          No Gurus found. Try changing filters or come back later.
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((g) => (
            <GuruCard key={g.id} guru={g} onBook={(gg) => { setBookingGuru(gg); setOpen(true); }} />
          ))}
        </section>
      )}

      <BookingModal guru={bookingGuru} open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBookingGuru(null); }} />
    </main>
  );
};

export default Consultations;
