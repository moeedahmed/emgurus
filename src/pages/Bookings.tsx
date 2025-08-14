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
  user_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  price: number;
  meeting_link: string | null;
}

export default function Bookings({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<BookingRow[]>([]);
  const [past, setPast] = useState<BookingRow[]>([]);
  const [gurus, setGurus] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [users, setUsers] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [isGuru, setIsGuru] = useState(false);

  useEffect(() => {
    document.title = "My Bookings | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'View all your upcoming and past bookings with EMGurus.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  // Check if user is a guru
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'guru').maybeSingle();
      setIsGuru(!!data);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const nowIso = new Date().toISOString();
      
      // Query bookings based on whether user is guru or customer
      const column = isGuru ? 'guru_id' : 'user_id';
      const partnerColumn = isGuru ? 'user_id' : 'guru_id';
      
      const [upcomingResult, pastResult] = await Promise.all([
        supabase
          .from('consult_bookings')
          .select(`id, ${partnerColumn}, start_datetime, end_datetime, status, price, meeting_link`)
          .eq(column, user.id)
          .gte('start_datetime', nowIso)
          .order('start_datetime', { ascending: true }),
        supabase
          .from('consult_bookings')
          .select(`id, ${partnerColumn}, start_datetime, end_datetime, status, price, meeting_link`)
          .eq(column, user.id)
          .lt('end_datetime', nowIso)
          .order('end_datetime', { ascending: false })
      ]);

      const upcomingRows = (upcomingResult.data || []) as any as BookingRow[];
      const pastRows = (pastResult.data || []) as any as BookingRow[];
      
      setUpcoming(upcomingRows);
      setPast(pastRows);

      // Get partner profiles (either gurus or users depending on user type)
      const allPartnerIds = Array.from(new Set([
        ...upcomingRows.map(r => r[partnerColumn as keyof BookingRow] as string),
        ...pastRows.map(r => r[partnerColumn as keyof BookingRow] as string)
      ]));

      if (allPartnerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', allPartnerIds);
        const map: Record<string, { name: string; avatar_url: string | null }> = {};
        (profs || []).forEach((p: any) => { 
          map[p.user_id] = { name: p.full_name || (isGuru ? 'Student' : 'Guru'), avatar_url: p.avatar_url || null }; 
        });
        
        if (isGuru) {
          setUsers(map);
        } else {
          setGurus(map);
        }
      }
    })();
  }, [user, isGuru]);

  const formatDate = (s: string) => new Date(s).toLocaleString();

  const title = useMemo(() => "Bookings", []);

  const renderBookingCard = (b: BookingRow, partnerData: { name: string; avatar_url: string | null }) => (
    <Card key={b.id} className="p-4">
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={partnerData.avatar_url || undefined} alt={partnerData.name} />
          <AvatarFallback>{partnerData.name.slice(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="font-medium truncate">
              {isGuru ? `Student: ${partnerData.name}` : partnerData.name}
            </div>
            <div className="text-sm font-medium">{b.price ? `$${b.price}` : 'Free'}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(b.start_datetime)} – {formatDate(b.end_datetime)} • {b.status}
          </div>
          {b.meeting_link && (
            <div className="text-sm pt-1">
              <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="underline">Meeting link</a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <main className={embedded ? "" : "container mx-auto px-4 py-8"}>
      {!embedded && (
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-muted-foreground">Your upcoming and past consultations.</p>
          </div>
        </header>
      )}

      {upcoming.length === 0 && past.length === 0 ? (
        <section className="text-center text-muted-foreground py-16">
          You have no bookings yet.
        </section>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Bookings */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Upcoming ({upcoming.length})</h2>
              <div className="space-y-4">
                {upcoming.map((b) => {
                  const partnerId = isGuru ? b.user_id : b.guru_id;
                  const partnerData = isGuru ? 
                    (users[partnerId] || { name: 'Student', avatar_url: null }) :
                    (gurus[partnerId] || { name: 'Guru', avatar_url: null });
                  return renderBookingCard(b, partnerData);
                })}
              </div>
            </section>
          )}

          {/* Past Bookings */}
          {past.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Past ({past.length})</h2>
              <div className="space-y-4">
                {past.map((b) => {
                  const partnerId = isGuru ? b.user_id : b.guru_id;
                  const partnerData = isGuru ? 
                    (users[partnerId] || { name: 'Student', avatar_url: null }) :
                    (gurus[partnerId] || { name: 'Guru', avatar_url: null });
                  return renderBookingCard(b, partnerData);
                })}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-8">
        <Separator />
      </div>
    </main>
  );
}
