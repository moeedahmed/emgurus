import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, X, Brain, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import Logo from "@/components/branding/Logo";
import { useRoles } from "@/hooks/useRoles";
import { CATEGORIES } from "@/lib/taxonomy";
import { listBlogs } from "@/lib/blogsApi";
import { supabase } from "@/integrations/supabase/client";
import NotificationsBell from "@/components/notifications/NotificationsBell";
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);
  const displayName = (profile?.full_name as string) || (user?.user_metadata?.full_name as string) || (user?.email?.split('@')[0] ?? 'Account');
  const initials = displayName.slice(0, 2).toUpperCase();
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const { roles } = useRoles();
  const isGuru = roles.includes('guru') || roles.includes('admin');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await listBlogs({ status: "published", page_size: 200 });
        const map: Record<string, number> = {};
        for (const t of CATEGORIES) map[t] = 0;
        for (const it of res.items || []) {
          const key = it.category?.title || "General";
          if (map[key] === undefined) map[key] = 0;
          map[key] += 1;
        }
        if (!cancelled) setCatCounts(map);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load user profile for name/avatar and subscribe to changes
  useEffect(() => {
    let sub: any;
    (async () => {
      if (!user) { setProfile(null); return; }
      const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('user_id', user.id).maybeSingle();
      setProfile(data || null);
      sub = supabase
        .channel('profile-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
          const rec: any = payload.new;
          setProfile({ full_name: rec.full_name, avatar_url: rec.avatar_url });
        })
        .subscribe();
    })();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button aria-label="Go to home" onClick={() => navigate('/')} className="flex items-center space-x-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
            <Logo />
          </button>

          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">Home</button>
            <HoverCard>
              <HoverCardTrigger asChild>
                <button onClick={() => navigate('/blogs')} className="text-muted-foreground hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">Blogs</button>
              </HoverCardTrigger>
              <HoverCardContent className="w-[520px]">
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => navigate(`/blogs?category=${encodeURIComponent(c)}`)} className="flex items-center justify-between rounded-md border p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
                      <span>{c}</span>
                      <span className="text-xs text-muted-foreground">{catCounts[c] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
            <button onClick={() => navigate('/exams')} className="text-muted-foreground hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">Exams</button>
            <button onClick={() => navigate('/consultations')} className="text-muted-foreground hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">Consultations</button>
            <button onClick={() => navigate('/forums')} className="text-muted-foreground hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">Forums</button>
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Notifications */}
            {user && (
              <div className="mr-1">
                <NotificationsBell />
              </div>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || (user.user_metadata?.avatar_url as string)} alt={displayName} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{displayName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <UserIcon className="mr-2 h-4 w-4" /> My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  {false && roles.includes('guru') && (
                    <DropdownMenuItem onClick={() => navigate('/guru/availability')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> My Availability
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>Sign In</Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            aria-label="Toggle menu"
            className="md:hidden p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col space-y-3">
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/'); setIsMenuOpen(false);}}>Home</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/blogs'); setIsMenuOpen(false);}}>Blogs</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/exams'); setIsMenuOpen(false);}}>Exams</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/consultations'); setIsMenuOpen(false);}}>Consultations</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/forums'); setIsMenuOpen(false);}}>Forums</button>
              {user && (
                <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" onClick={() => {navigate('/dashboard'); setIsMenuOpen(false);}}>Dashboard</button>
              )}

              <Separator className="my-4" />

              <div className="flex flex-col space-y-3">
                {user ? (
                  <>
                    <div className="px-2 text-xs uppercase text-muted-foreground">Account</div>
                    <div className="flex items-center gap-3 px-2 py-2 rounded-md border border-border bg-card/30">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url || (user?.user_metadata?.avatar_url as string)} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm text-foreground">{displayName}</div>
                    </div>
                    <Button variant="outline" className="justify-start" onClick={() => {navigate('/profile'); setIsMenuOpen(false);}}>My Profile</Button>
                    <Button variant="outline" className="justify-start" onClick={signOut}>Sign Out</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="justify-start" onClick={() => {navigate('/auth'); setIsMenuOpen(false);}}>Sign In</Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;