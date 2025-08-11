import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AIGuru from "@/components/ai/AIGuru";
import { Button } from "@/components/ui/button";

function needsOnboarding(profile: any): boolean {
  if (!profile) return true;
  const full_name = (profile.full_name || '').trim();
  const timezone = (profile.timezone || '').trim();
  const country = (profile.country || '').trim();
  const primary = (profile.primary_specialty || profile.specialty || '').trim();
  const exams = (profile.exam_interests || profile.exams || []) as string[];
  const languages = (profile.languages || []) as string[];
  const bio = (profile.bio || '').trim();
  const avatar = (profile.avatar_url || '').trim();
  const meets = !!full_name && !!timezone && !!country && !!primary && exams.length > 0 && languages.length > 0 && bio.length >= 100 && !!avatar;
  return !meets;
}

const SiteLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user) { setProfile(null); return; }
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (!mounted) return;
        setProfile(data || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  const shouldForceOnboarding = useMemo(() => {
    if (!user || !profile) return false;
    // Only force when the flag is true
    return !!profile.onboarding_required && needsOnboarding(profile);
  }, [user, profile]);

  useEffect(() => {
    if (!user || loading) return;
    const path = location.pathname;
    const onOnboarding = path.startsWith('/onboarding') || path.startsWith('/auth');
    if (shouldForceOnboarding && !onOnboarding) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, loading, shouldForceOnboarding, location.pathname, navigate]);

  const showReminderBanner = useMemo(() => {
    if (!user || !profile) return false;
    if (bannerDismissed) return false;
    // For existing users we set onboarding_required=false via migration
    if (profile.onboarding_required) return false;
    return needsOnboarding(profile);
  }, [user, profile, bannerDismissed]);

  const dismissBanner = () => {
    if (!user) return;
    localStorage.setItem(`onboarding_banner_dismissed_${user.id}`, '1');
    setBannerDismissed(true);
  };

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(`onboarding_banner_dismissed_${user.id}`) === '1';
    setBannerDismissed(dismissed);
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {showReminderBanner && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 text-sm">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              Complete your profile to get the best experience (about 2 minutes).
            </div>
              <div className="flex items-center gap-2">
                <Button variant="link" className="px-0" onClick={() => navigate('/onboarding')}>Complete now</Button>
                <Button variant="ghost" onClick={dismissBanner}>Dismiss</Button>
              </div>
          </div>
        </div>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AIGuru />
    </div>
  );
};

export default SiteLayout;
