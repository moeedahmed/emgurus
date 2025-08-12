import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import KpiCard from "@/components/dashboard/KpiCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";
interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  timezone: string | null;
  country: string | null;
  specialty: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  exams: string[] | null;
  languages: string[] | null;
  bio: string | null;
  linkedin: string | null;
  twitter: string | null;
  website: string | null;
  price_per_30min: number | null;
  onboarding_progress?: any;
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
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [guruNames, setGuruNames] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [hourly, setHourly] = useState<number | "">("");
  const [bookingCounts, setBookingCounts] = useState<{ total: number; upcoming: number }>({ total: 0, upcoming: 0 });

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
        .select('user_id, full_name, email, timezone, country, specialty, avatar_url, cover_image_url, exams, languages, bio, linkedin, twitter, website, price_per_30min')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile(prof as any);
      setHourly(prof?.price_per_30min ? Number(prof.price_per_30min) : "");

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

      // Counts
      const nowIso = new Date().toISOString();
      const [{ count: totalCount }, { count: upcomingCount }] = await Promise.all([
        supabase.from('consult_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('consult_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'confirmed').gte('start_datetime', nowIso),
      ] as any);
      setBookingCounts({ total: totalCount || 0, upcoming: upcomingCount || 0 });

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

  const handleChangePassword = async () => {
    if (!pwd || pwd.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters." });
      return;
    }
    if (pwd !== pwd2) {
      toast({ title: "Passwords do not match" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      toast({ title: "Could not update password", description: error.message });
      return;
    }
    toast({ title: "Password updated" });
    setPwd("");
    setPwd2("");
  };

  const confirmCancel = async () => {
    if (!cancelId) return;
    try {
      setCancellingId(cancelId);
      const res = await fetch(`${SUPABASE_EDGE}/api/bookings/${cancelId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');
      setBookings((prev) => prev.filter((b) => b.id !== cancelId));
      toast({ title: 'Booking cancelled' });
    } catch (e: any) {
      toast({ title: 'Cancel failed', description: e.message });
    } finally {
      setCancellingId(null);
      setConfirmOpen(false);
      setCancelId(null);
    }
  };

  const initials = useMemo(() => {
    const name = profile?.full_name || user?.email || 'User';
    return name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  }, [profile?.full_name, user?.email]);

  const isGuru = roles.includes('guru');
  const isAdmin = roles.includes('admin');
  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10 overflow-x-hidden">
      {/* Cover Banner (only when image exists) */}
      {profile?.cover_image_url && (
        <section className="w-full h-32 md:h-44 relative">
          <img
            src={profile.cover_image_url}
            alt="Profile cover image"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </section>
      )}

      <article className="mt-4 md:mt-6 px-4 md:px-4 max-w-full overflow-x-hidden">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left column: Profile summary */}
          <Card className="w-full overflow-hidden p-6 md:col-span-1 shadow-md">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-background">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Avatar'} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold break-words">{profile?.full_name || user?.email}</h1>
                <div className="flex gap-1 flex-wrap pt-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary">{r}</Badge>
                  ))}
                </div>
                {(profile?.linkedin || profile?.twitter || profile?.website) && (
                  <div className="flex gap-3 text-sm pt-2">
                    {profile?.linkedin && (<a href={profile.linkedin} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>)}
                    {profile?.twitter && (<a href={profile.twitter} target="_blank" rel="noreferrer" className="underline">X (Twitter)</a>)}
                    {profile?.website && (<a href={profile.website} target="_blank" rel="noreferrer" className="underline">Website</a>)}
                  </div>
                )}
              </div>
            </div>

            {/* Actions (profile only) */}
            <div className="flex gap-3 pt-2 flex-wrap">
              <Link to="/onboarding"><Button variant="outline" className="w-full sm:w-auto">Edit Profile</Button></Link>
            </div>

            <Separator className="my-4" />
            <div className="space-y-4">
              <div>
                <div className="font-semibold">About</div>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Email</span>
                      <a href={`mailto:${profile?.email || user?.email}`} className="underline break-words">{profile?.email || user?.email}</a>
                    </div>
                    {profile?.specialty && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Specialty</span>
                        <span className="break-words">{profile.specialty}</span>
                      </div>
                    )}
                    {profile?.country && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Country</span>
                        <span className="break-words">{profile.country}</span>
                      </div>
                    )}
                    {profile?.timezone && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Timezone</span>
                        <span className="break-words">{profile.timezone}</span>
                      </div>
                    )}
                    {(profile?.exams || []).length > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Exams</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                          {(profile?.exams || []).map((e) => (
                            <Badge key={e} variant="outline">{e}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(profile?.languages || []).length > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Languages</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                          {(profile?.languages || []).map((l) => (
                            <Badge key={l} variant="outline">{l}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {profile?.bio && (
                    <p className="text-sm text-muted-foreground break-words pt-2">{profile.bio}</p>
                  )}
                </div>
              </div>
            </div>

          </Card>

          {/* Right column: Tabs with role-aware sections */}
          <div className="md:col-span-2 min-w-0">
              <Tabs defaultValue="bookings" className="w-full">
                <TabsList className={`w-full max-w-full overflow-x-auto grid ${isGuru ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  {isGuru && <TabsTrigger value="guru">Guru</TabsTrigger>}
                </TabsList>

              {/* BOOKINGS */}
              <TabsContent value="bookings" className="mt-4">
                <Card className="w-full overflow-hidden p-6 shadow-md mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard title="Total bookings" value={String(bookingCounts.total)} />
                    <KpiCard title="Upcoming" value={String(bookingCounts.upcoming)} />
                  </div>
                  <div className="flex gap-3 pt-4 flex-wrap">
                    <Link to="/consultations"><Button variant="secondary" className="w-full sm:w-auto">Find Gurus</Button></Link>
                    {!isGuru && <ApplyGuruButton />}
                  </div>
                </Card>
                <Card className="w-full overflow-hidden p-6 space-y-3 shadow-md">
                  <div className="font-semibold">Your Bookings</div>
                  <Separator />
                  {bookings.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No bookings yet.</div>
                  ) : (
                    <ul className="space-y-3">
                      {bookings.map((b) => {
                        const isFuture = new Date(b.start_datetime).getTime() > Date.now();
                        const isCancelable = b.status === 'confirmed' && isFuture;
                        return (
                          <li key={b.id} className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-sm"><Link to={`/profile/${b.guru_id}`} className="hover:underline">{guruNames[b.guru_id]?.name || 'Guru'}</Link></div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(b.start_datetime).toLocaleString()} • {b.status}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{b.price ? `$${b.price}` : 'Free'}</div>
                              {isCancelable && (
                                <Button size="sm" variant="outline" onClick={() => { setCancelId(b.id); setConfirmOpen(true); }} disabled={cancellingId === b.id}>
                                  {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </TabsContent>

              {/* SECURITY */}
              <TabsContent value="security" className="mt-4">
                <Card className="w-full overflow-hidden p-6 max-w-xl space-y-4 shadow-md">
                  <div className="font-semibold">Change Password</div>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="new-password">New password</Label>
                      <Input id="new-password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input id="confirm-password" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
                    </div>
                    <Button onClick={handleChangePassword}>Update Password</Button>
                  </div>
                </Card>
              </TabsContent>

              {/* GURU */}
              <TabsContent value="guru" className="mt-4 space-y-6">
                {isGuru ? (
                  <>
                    <Card id="pricing" className="w-full overflow-hidden p-6 space-y-4 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Pricing</div>
                        {profile?.price_per_30min ? (
                          <div className="text-sm text-muted-foreground">Stored as ${'{'}profile.price_per_30min{'}'} / 30 min</div>
                        ) : null}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full max-w-md">
                        <Label htmlFor="hourly" className="sm:w-44">Price per 30 min (USD)</Label>
                        <div className="flex w-full gap-3">
                          <Input id="hourly" className="flex-1" type="number" min={0} step={1} value={hourly} onChange={(e) => setHourly(e.target.value === '' ? '' : Number(e.target.value))} />
                          <Button className="sm:w-auto w-full" onClick={async () => {
                            if (hourly === '' || hourly < 0) { toast({ title: 'Enter a valid price per 30 min' }); return; }
                            const per30 = Math.round(Number(hourly) * 100) / 100;
                            const { error } = await supabase.from('profiles').update({ price_per_30min: per30 }).eq('user_id', user!.id);
                            if (error) { toast({ title: 'Could not save', description: error.message }); } else { toast({ title: 'Pricing updated' }); setProfile(p => p ? ({ ...p, price_per_30min: per30 }) : p); }
                          }}>Save</Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="w-full overflow-hidden p-6 shadow-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Availability</div>
                          <p className="text-sm text-muted-foreground">Manage time slots students can book.</p>
                        </div>
                        <Link to="/guru/availability"><Button>Open Availability</Button></Link>
                      </div>
                    </Card>
                  </>
                ) : (
                  <Card className="w-full overflow-hidden p-6 shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Become a Guru</div>
                        <p className="text-sm text-muted-foreground">Share your expertise and earn by mentoring learners.</p>
                      </div>
                      <ApplyGuruButton />
                    </div>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </article>

      {/* Cancel dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your session and reopen the slot. {''}
              {"If it was a paid booking, a Stripe refund will be processed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={!cancelId || (cancellingId === cancelId)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function ApplyGuruButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('guru_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0 && data[0].status === 'pending') setPending(true);
    })();
  }, [user]);

  const submit = async () => {
    if (!user) return;
    try {
      setSubmitting(true);
      const { error } = await supabase.from('guru_applications').insert({ user_id: user.id, notes: why, status: 'pending' });
      if (error) throw error;
      setPending(true);
      toast({ title: 'Application submitted', description: 'We will notify you after review.' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Could not submit', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={pending}>Become Guru</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to become a Guru</AlertDialogTitle>
            <AlertDialogDescription>
              Share a short note on why you want to become a Guru. Admins will review your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="why">Why do you want to become a Guru?</Label>
            <textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} className="min-h-[100px] rounded-md border p-2 bg-background" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={submitting}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
