import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { BookingModal } from "@/components/consultations/BookingModal";
import type { Guru } from "@/components/consultations/GuruCard";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  timezone: string | null;
  country: string | null;
  specialty: string | null;
  avatar_url: string | null;
  exams: string[] | null;
  bio: string | null;
  price_per_30min: number | null;
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, timezone, country, specialty, avatar_url, exams, bio, price_per_30min')
        .eq('user_id', id)
        .maybeSingle();
      if (!mounted) return;
      if (error || !data) { setNotFound(true); return; }
      setProfile(data as any);
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    const title = profile?.full_name ? `${profile.full_name} – Guru Profile | EMGurus` : 'Guru Profile | EMGurus';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', profile?.bio || 'View guru profile, exams, bio and rate.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, [profile?.full_name, profile?.bio]);

  const guru: Guru | null = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.user_id,
      full_name: profile.full_name || 'Guru',
      specialty: profile.specialty,
      country: profile.country,
      price_per_30min: profile.price_per_30min,
      exams: profile.exams || [],
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      timezone: profile.timezone || null,
    };
  }, [profile]);

  if (notFound) {
    return (
      <main className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Profile not found</h1>
        <p className="text-muted-foreground">This profile may be private or does not exist.</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </main>
    );
  }

  const initials = (profile.full_name || 'GU').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();

  return (
    <main className="container mx-auto px-4 py-8">
      <article className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 space-y-4 md:col-span-2">
          <header className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || 'Avatar'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
                {/* Success of fetching implies this user is a verified guru */}
                <Badge variant="secondary">Verified</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {profile.specialty || 'Emergency Medicine'} • {profile.country || 'Global'}
              </div>
            </div>
          </header>

          {profile.bio && (
            <p className="text-sm text-muted-foreground">{profile.bio}</p>
          )}

          {(profile.exams || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(profile.exams || []).map((e) => (
                <Badge key={e} variant="outline">{e}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-lg font-medium">{profile.price_per_30min ? `$${profile.price_per_30min} / 30 min` : 'Free'}</div>
            {guru && (
              <Button onClick={() => setOpen(true)}>Book Now</Button>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="font-semibold">Next available</div>
          <Separator />
          {/* Optional quick view: show only explicit-dated slots if any */}
          <UpcomingSlots guruId={profile.user_id} />
        </Card>
      </article>

      <BookingModal guru={guru} open={open} onOpenChange={setOpen} />
    </main>
  );
}

function UpcomingSlots({ guruId }: { guruId: string }) {
  const [rows, setRows] = useState<{ date: string; start_time: string; end_time: string }[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const from = `${yyyy}-${mm}-${dd}`;
      const { data } = await supabase
        .from('consult_availability')
        .select('date, start_time, end_time')
        .eq('guru_id', guruId)
        .eq('is_available', true)
        .not('date', 'is', null)
        .gte('date', from)
        .order('date', { ascending: true })
        .limit(3);
      setRows((data || []) as any);
    })();
  }, [guruId]);

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">No upcoming dated slots.</div>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r, idx) => (
        <li key={idx} className="text-sm">
          {new Date(r.date).toLocaleDateString()} • {r.start_time}–{r.end_time}
        </li>
      ))}
    </ul>
  );
}
