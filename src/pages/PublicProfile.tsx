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
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  timezone: string | null;
  country: string | null;
  specialty: string | null;
  avatar_url: string | null;
  exams: string[] | null;
  languages: string[] | null;
  bio: string | null;
  price_per_30min: number | null;
  linkedin: string | null;
  twitter: string | null;
  website: string | null;
  cover_image_url: string | null;
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, timezone, country, specialty, primary_specialty, avatar_url, exam_interests, exams, languages, bio, price_per_30min, cover_image_url, linkedin, twitter, website')
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
      specialty: (profile as any).primary_specialty || profile.specialty,
      country: profile.country,
      price_per_30min: profile.price_per_30min,
      exams: ((profile as any).exam_interests || profile.exams || []),
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
  const hasCover = !!(profile as any).cover_image_url && String((profile as any).cover_image_url).trim() !== "";
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Profile URL copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Couldn't copy it automatically. Please copy the URL manually.", variant: "destructive" });
    }
  };

  return (
    <main className="container mx-auto px-0 md:px-4 py-0 md:py-8">
      {/* Cover Banner */}
      {hasCover && (
        <section className="w-full h-40 md:h-56 relative">
          <img
            src={(profile as any).cover_image_url as any}
            alt={`${profile.full_name || 'Profile'} cover image`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </section>
      )}


      <article className={cn("px-4", hasCover ? "-mt-10 md:-mt-14" : "mt-6 md:mt-10")}>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 md:col-span-2">
            <header className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-background">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || 'Avatar'} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
                </div>
              </div>
            </header>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Specialty</div>
                <div className="text-sm font-medium">{(profile as any).primary_specialty || profile.specialty || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Country</div>
                <div className="text-sm font-medium">{profile.country || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Timezone</div>
                <div className="text-sm font-medium">{profile.timezone || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Languages</div>
                <div className="text-sm font-medium">{(profile.languages || []).join(', ') || '—'}</div>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-3">{profile.bio}</p>
            )}


            {(profile.exams || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(profile.exams || []).map((e) => (
                  <Badge key={e} variant="outline">{e}</Badge>
                ))}
              </div>
            )}

            {(profile.languages || []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(profile.languages || []).map((l) => (
                  <Badge key={l} variant="outline">{l}</Badge>
                ))}
              </div>
            )}

            {/* Socials are always public if present */}
            {(profile.linkedin || profile.twitter || profile.website) && (
              <div className="flex gap-3 pt-3 text-sm">
                {profile.linkedin && (
                  <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="underline">LinkedIn</a>
                )}
                {profile.twitter && (
                  <a href={profile.twitter} target="_blank" rel="noreferrer" aria-label="X (Twitter)" className="underline">X</a>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noreferrer" aria-label="Website" className="underline">Website</a>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <div className="text-lg font-medium">{profile.price_per_30min ? `$${profile.price_per_30min} / 30 min` : 'Free'}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleShare} aria-label="Share profile">Share profile</Button>
                {guru && (
                  <Button onClick={() => setOpen(true)} aria-label="Book consultation with guru">Book Now</Button>
                )}
              </div>
            </div>

          </Card>

          <Card className="p-6 space-y-3">
            <div className="font-semibold">Next available</div>
            <Separator />
            <UpcomingSlots guruId={profile.user_id} />
          </Card>
        </div>
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
