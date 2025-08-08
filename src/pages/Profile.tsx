import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  timezone: string | null;
  country: string | null;
  specialty: string | null;
  avatar_url: string | null;
  exams: string[] | null;
  bio: string | null;
}

interface BookingRow {
  id: string;
  guru_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  price: number;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [guruNames, setGuruNames] = useState<Record<string, { name: string; avatar_url: string | null }>>({});

  useEffect(() => {
    document.title = "My Profile | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'View your profile, roles, timezone, and recent bookings.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, timezone, country, specialty, avatar_url, exams, bio')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile(prof as any);

      const { data: r } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setRoles((r || []).map(x => x.role as string));

      const { data: b } = await supabase
        .from('consult_bookings')
        .select('id, guru_id, start_datetime, end_datetime, status, price')
        .eq('user_id', user.id)
        .order('start_datetime', { ascending: false })
        .limit(5);
      const rows = (b || []) as any as BookingRow[];
      setBookings(rows);

      const guruIds = Array.from(new Set(rows.map(x => x.guru_id)));
      if (guruIds.length) {
        const { data: gp } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', guruIds);
        const map: Record<string, { name: string; avatar_url: string | null }> = {};
        (gp || []).forEach((p: any) => { map[p.user_id] = { name: p.full_name || 'Guru', avatar_url: p.avatar_url || null }; });
        setGuruNames(map);
      }
    })();
  }, [user]);

  const initials = useMemo(() => {
    const name = profile?.full_name || user?.email || 'User';
    return name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  }, [profile?.full_name, user?.email]);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your account and view recent bookings.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-2 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Avatar'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xl font-semibold">{profile?.full_name || user?.email}</div>
                <div className="flex gap-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary">{r}</Badge>
                  ))}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{profile?.email || user?.email}</div>
              {profile?.timezone && (
                <div className="text-sm text-muted-foreground">Timezone: {profile.timezone}</div>
              )}
            </div>
          </div>

          {profile?.bio && (
            <p className="text-sm text-muted-foreground">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {(profile?.exams || []).map((e) => (
              <Badge key={e} variant="outline">{e}</Badge>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Link to="/consultations"><Button variant="secondary">Find Gurus</Button></Link>
            {roles.includes('guru') && (
              <Link to="/guru/availability"><Button>My Availability</Button></Link>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="font-semibold">Recent Bookings</div>
          <Separator />
          {bookings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bookings yet.</div>
          ) : (
            <ul className="space-y-3">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{guruNames[b.guru_id]?.name || 'Guru'}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(b.start_datetime).toLocaleString()} • {b.status}
                    </div>
                  </div>
                  <div className="text-sm font-medium">{b.price ? `$${b.price}` : 'Free'}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </main>
  );
}
