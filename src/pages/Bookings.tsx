import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface BookingRow {
  id: string;
  guru_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  price: number;
  meeting_link: string | null;
}

export default function Bookings() {
  const { user } = useAuth();
  const [past, setPast] = useState<BookingRow[]>([]);
  const [gurus, setGurus] = useState<Record<string, { name: string; avatar_url: string | null }>>({});

  useEffect(() => {
    document.title = "My Bookings | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'View all your past bookings with EMGurus.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('consult_bookings')
        .select('id, guru_id, start_datetime, end_datetime, status, price, meeting_link')
        .eq('user_id', user.id)
        .lt('end_datetime', nowIso)
        .order('end_datetime', { ascending: false });
      const rows = (data || []) as any as BookingRow[];
      setPast(rows);
      const ids = Array.from(new Set(rows.map(r => r.guru_id)));
      if (ids.length) {
        const { data: gp } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', ids);
        const map: Record<string, { name: string; avatar_url: string | null }> = {};
        (gp || []).forEach((p: any) => { map[p.user_id] = { name: p.full_name || 'Guru', avatar_url: p.avatar_url || null }; });
        setGurus(map);
      }
    })();
  }, [user]);

  const formatDate = (s: string) => new Date(s).toLocaleString();

  const title = useMemo(() => "Bookings", []);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">Your upcoming and past consultations.</p>
        </div>
      </header>

      {past.length === 0 ? (
        <section className="text-center text-muted-foreground py-16">
          You have no bookings yet.
        </section>
      ) : (
        <section className="space-y-4">
          {past.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={gurus[b.guru_id]?.avatar_url || undefined} alt={gurus[b.guru_id]?.name || 'Guru'} />
                  <AvatarFallback>{(gurus[b.guru_id]?.name || 'GU').slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{gurus[b.guru_id]?.name || 'Guru'}</div>
                    <div className="text-sm font-medium">{b.price ? `$${b.price}` : 'Free'}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDate(b.start_datetime)} – {formatDate(b.end_datetime)} • {b.status}</div>
                  {b.meeting_link && (
                    <div className="text-sm pt-1">
                      <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="underline">Meeting link</a>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}

      <div className="mt-8">
        <Separator />
      </div>
    </main>
  );
}
