import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TagInput from "@/components/forms/TagInput";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Linkedin, Twitter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  timezone: string | null;
  country: string | null;
  specialty: string | null;
  primary_specialty?: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  exams: string[] | null;
  exam_interests?: string[] | null;
  languages: string[] | null;
  bio: string | null;
  linkedin: string | null;
  twitter: string | null;
  price_per_30min: number | null;
  position?: string | null;
  hospital?: string | null;
  onboarding_progress?: any;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");

  // Inline edit form state
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [tz, setTz] = useState("");
  const [primarySpecialty, setPrimarySpecialty] = useState("");
  const [examInterests, setExamInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [positionText, setPositionText] = useState("");
  const [hospitalText, setHospitalText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  // Security
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  // Social connect helpers
  const onConnect = async (provider: "linkedin_oidc" | "twitter") => {
    const redirectUrl = `${window.location.origin}/profile`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: redirectUrl } as any });
    if (error) toast({ title: `Could not start ${provider} connect` });
  };

  useEffect(() => {
    document.title = "My Profile | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'Edit your profile information and security settings.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  // Load profile + seed form
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, timezone, country, specialty, primary_specialty, avatar_url, cover_image_url, exams, exam_interests, languages, bio, linkedin, twitter, price_per_30min, position, hospital, onboarding_progress')
        .eq('user_id', user.id)
        .maybeSingle();
      const row = prof as any;
      setProfile(row ?? null);

      // Initialize edit form state
      setFullName(row?.full_name || '');
      setCountry(row?.country || '');
      setTz(row?.timezone || '');
      setPrimarySpecialty(row?.primary_specialty || row?.specialty || '');
      setExamInterests((row?.exam_interests || row?.exams || []) as string[]);
      setLanguages((row?.languages || []) as string[]);
      setBio(row?.bio || '');
      setPositionText(row?.position || '');
      setHospitalText(row?.hospital || '');
      setLinkedinUrl(row?.linkedin || '');
      setTwitterUrl(row?.twitter || '');

      // Focus Profile tab if mandatory fields missing
      const missing = !row?.full_name || !row?.country || !(row?.primary_specialty || row?.specialty) || !row?.timezone || !((row?.exam_interests || row?.exams || []).length) || !((row?.languages || []).length);
      if (missing) setActiveTab('profile');
    })();
  }, [user]);

  // After OAuth connect, capture social URLs (if provided by provider)
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: authUserRes } = await supabase.auth.getUser();
      const identities = (authUserRes.user as any)?.identities || [];
      let updates: any = {};
      for (const ident of identities) {
        const provider = (ident as any).provider as string;
        const idata = (ident as any).identity_data || {};
        if (provider === 'linkedin_oidc') {
          const url = idata.url || idata.profile || null;
          if (url && !linkedinUrl) { updates.linkedin = url; setLinkedinUrl(url); }
        }
        if (provider === 'twitter') {
          const url = idata.url || (idata.username ? `https://twitter.com/${idata.username}` : null);
          if (url && !twitterUrl) { updates.twitter = url; setTwitterUrl(url); }
        }
      }
      if (Object.keys(updates).length) {
        await supabase.from('profiles').update(updates).eq('user_id', user.id);
        setProfile(p => p ? ({ ...p, ...updates }) : p);
      }
    })();
  }, [user?.id, linkedinUrl, twitterUrl]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const payload: any = {
        full_name: fullName,
        country,
        timezone: tz,
        primary_specialty: primarySpecialty,
        specialty: primarySpecialty,
        exam_interests: examInterests,
        exams: examInterests,
        languages,
        bio,
        position: positionText,
        hospital: hospitalText,
        linkedin: linkedinUrl || null,
        twitter: twitterUrl || null,
        onboarding_required: false,
      };
      const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
      if (error) { toast({ title: 'Could not save', description: error.message }); return; }
      setProfile(p => p ? ({ ...p, ...payload }) : p);
      toast({ title: 'Profile updated' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message });
    }
  };

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
    if (error) { toast({ title: "Could not update password", description: error.message }); return; }
    toast({ title: "Password updated" });
    setPwd(""); setPwd2("");
  };

  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <article className="max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* PROFILE EDIT */}
          <TabsContent value="profile" className="mt-4">
            <Card className="w-full overflow-hidden p-6 shadow-md space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Primary specialty</Label>
                  <TagInput value={primarySpecialty ? [primarySpecialty] : []} onChange={(vals) => setPrimarySpecialty(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type specialty" />
                </div>
                <div className="grid gap-1">
                  <Label>Country</Label>
                  <TagInput value={country ? [country] : []} onChange={(vals) => setCountry(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type country" />
                </div>
                <div className="grid gap-1">
                  <Label>Timezone</Label>
                  <TagInput value={tz ? [tz] : []} onChange={(vals) => setTz(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type timezone (e.g., Europe/London)" />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Exam interests</Label>
                  <TagInput value={examInterests} onChange={setExamInterests} suggestions={[]} placeholder="Type exams and press Enter" />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Languages</Label>
                  <TagInput value={languages} onChange={setLanguages} suggestions={[]} placeholder="Type languages and press Enter" />
                </div>
                <div className="grid gap-1">
                  <Label>Position</Label>
                  <Input value={positionText} onChange={(e) => setPositionText(e.target.value)} placeholder="e.g., Senior Registrar" />
                </div>
                <div className="grid gap-1">
                  <Label>Hospital/Employer</Label>
                  <Input value={hospitalText} onChange={(e) => setHospitalText(e.target.value)} placeholder="e.g., City Hospital" />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Bio</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Social accounts</Label>
                  <div className="flex gap-3 flex-wrap">
                    <Button variant="outline" onClick={() => onConnect('linkedin_oidc')} disabled={!!linkedinUrl} className="inline-flex items-center gap-2">
                      <Linkedin className="h-4 w-4" /> {linkedinUrl ? 'LinkedIn connected' : 'Connect LinkedIn'}
                    </Button>
                    <Button variant="outline" onClick={() => onConnect('twitter')} disabled={!!twitterUrl} className="inline-flex items-center gap-2">
                      <Twitter className="h-4 w-4" /> {twitterUrl ? 'X connected' : 'Connect X'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Connected accounts appear as icons on your public profile.</p>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave}>Save changes</Button>
              </div>
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
        </Tabs>
      </article>
    </main>
  );
}
