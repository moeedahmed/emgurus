import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GuruCard, type Guru } from "@/components/consultations/GuruCard";
import { BookingModal } from "@/components/consultations/BookingModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageHero from "@/components/PageHero";
import { Chip } from "@/components/ui/chip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ConsultationsFilterPanel from "@/components/consultations/ConsultationsFilterPanel";

const Consultations = ({ embedded = false }: { embedded?: boolean } = {}) => {
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
  const SUPABASE_EDGE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultations-api`;

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
        console.error('Consultations API error:', e);
        // Show graceful fallback for failed membership/API calls
        setGurus([]);
        toast.error('Unable to load consultations. Please check your membership status or try again later.');
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
    <main>
      {!embedded && (
        <PageHero
          title="Consults"
          subtitle="Get guidance and expert support when you need it most."
          align="center"
          ctas={[{ label: "Consults Membership", href: "/pricing", variant: "default" }]}
        />
      )}

      <section className="container mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-20">
              <div className="max-h-[calc(100vh-6rem)] overflow-auto pr-2 space-y-6">
                <ConsultationsFilterPanel
                  search={search}
                  country={country}
                  specialty={specialty}
                  exam={exam}
                  countries={countries}
                  specialties={specialties}
                  exams={exams}
                  onChange={(k, v) => {
                    if (k === 'search') setSearch(v);
                    if (k === 'country') setCountry(v);
                    if (k === 'specialty') setSpecialty(v);
                    if (k === 'exam') setExam(v);
                  }}
                  onReset={() => { setSearch(''); setCountry('all'); setSpecialty('all'); setExam('all'); }}
                />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div>
            {/* Filters Button (mobile only) */}
            <div className="mb-4 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Filters</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 sm:w-96">
                  <ConsultationsFilterPanel
                    search={search}
                    country={country}
                    specialty={specialty}
                    exam={exam}
                    countries={countries}
                    specialties={specialties}
                    exams={exams}
                    onChange={(k, v) => {
                      if (k === 'search') setSearch(v);
                      if (k === 'country') setCountry(v);
                      if (k === 'specialty') setSpecialty(v);
                      if (k === 'exam') setExam(v);
                    }}
                    onReset={() => { setSearch(''); setCountry('all'); setSpecialty('all'); setExam('all'); }}
                  />
                </SheetContent>
              </Sheet>
            </div>

            {/* Active filters row */}
            {(country !== 'all' || specialty !== 'all' || exam !== 'all') && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {country !== 'all' && (
                  <Chip name="consultations_active_country" value={country} selected variant="solid" size="sm" onSelect={() => setCountry('all')}>
                    {country} ×
                  </Chip>
                )}
                {specialty !== 'all' && (
                  <Chip name="consultations_active_specialty" value={specialty} selected variant="solid" size="sm" onSelect={() => setSpecialty('all')}>
                    {specialty} ×
                  </Chip>
                )}
                {exam !== 'all' && (
                  <Chip name="consultations_active_exam" value={exam} selected variant="solid" size="sm" onSelect={() => setExam('all')}>
                    {exam} ×
                  </Chip>
                )}
                <Chip name="consultations_clear" value="clear" variant="ghost" size="sm" onSelect={() => { setCountry('all'); setSpecialty('all'); setExam('all'); }}>
                  Clear all
                </Chip>
              </div>
            )}

            <div className="text-sm text-muted-foreground mb-4">{filtered.length} mentors found</div>

            {loading ? (
              <section className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <div className="text-muted-foreground">Loading consultations...</div>
              </section>
            ) : filtered.length === 0 ? (
              <section className="text-center text-muted-foreground py-12">
                {gurus.length === 0 ? (
                  <div className="space-y-3">
                    <div className="font-medium">No membership found</div>
                    <div className="text-sm">Please upgrade to access consultations or try again later.</div>
                    <Button variant="outline" onClick={() => window.location.href = '/pricing'}>
                      View Pricing
                    </Button>
                  </div>
                ) : (
                  "No Gurus found. Try changing filters or come back later."
                )}
              </section>
            ) : (
              <section className="space-y-4">
                {filtered.map((g) => (
                  <GuruCard
                    key={g.id}
                    guru={g}
                    onBook={(gg) => { setBookingGuru(gg); setOpen(true); }}
                    onBadgeClick={(type, value) => {
                      if (type === 'exam') setExam(value);
                      if (type === 'specialty') setSpecialty(value);
                    }}
                  />
                ))}
              </section>
            )}

            <BookingModal guru={bookingGuru} open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBookingGuru(null); }} />
          </div>
        </div>
      </section>
  </main>
  );
};

export default Consultations;
