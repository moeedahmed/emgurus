import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExperienceSelect } from "@/components/forms/ExperienceSelect";

const countries = ["United Kingdom","United States","United Arab Emirates","India","Pakistan","Canada","Australia"];
const specialties = ["Emergency Medicine","Internal Medicine","Surgery","Pediatrics","Radiology"];
const examOptions = ["MRCEM (UK)","FRCEM (UK)","FCPS (Pakistan)","MRCS (EM)","FCEM (India)","ABEM (US)","FACEM (Australia)","PLAB","USMLE","Other"];
const timezones = ["UTC","Europe/London","America/New_York","Asia/Dubai","Asia/Kolkata","Asia/Karachi","Australia/Sydney"];
const languageOptions = ["English","Arabic","Hindi","Urdu","French","Spanish","Other"];

export default function Onboarding() {
  const { user } = useAuth();
  const [step] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [country, setCountry] = useState("");
  const [tz, setTz] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [otherLanguage, setOtherLanguage] = useState("");

  // Step 2
  const [primarySpecialty, setPrimarySpecialty] = useState("");
  const [examInterests, setExamInterests] = useState<string[]>([]);
  const [otherExam, setOtherExam] = useState("");
  const [years, setYears] = useState<number | "">("");
  const [position, setPosition] = useState("");
  const [hospital, setHospital] = useState("");

  // Step 3
  const [bio, setBio] = useState("");
  const [showProfilePublic, setShowProfilePublic] = useState(true);
  const [showSocialsPublic, setShowSocialsPublic] = useState(true);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Complete your profile | EM Gurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Finish onboarding to access EM Gurus.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setCountry(data.country || "");
        setTz(data.timezone || "");
        setLanguages((data.languages as any) || []);
        setPrimarySpecialty((data as any).primary_specialty || data.specialty || "");
        setExamInterests(((data as any).exam_interests as any) || data.exams || []);
        setBio(data.bio || "");
        setPosition((data as any).position || "");
        setHospital((data as any).hospital || "");
        setYears((data as any).years_experience || "");
        setShowProfilePublic((data as any).show_profile_public ?? true);
        setShowSocialsPublic((data as any).show_socials_public ?? true);
        setLinkedinUrl((data as any).linkedin || "");
        setTwitterUrl((data as any).twitter || "");
        const draft = (data as any).onboarding_progress || {};
        if (draft.step) {/* no-op now that onboarding is single page */}
      }
      setLoading(false);
    })();
  }, [user?.id]);

  // After redirect from social connect, upsert identities to DB and adopt avatar when missing
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: authUserRes } = await supabase.auth.getUser();
      const identities = (authUserRes.user as any)?.identities || [];
      if (!identities.length) return;
      let adoptedAvatar = false;
      for (const ident of identities) {
        const provider = ident.provider as string;
        if (provider !== 'linkedin_oidc' && provider !== 'twitter') continue;
        const idata = ident.identity_data || {};
        const handle = idata.preferred_username || idata.username || idata.name || null;
        const avatar = idata.picture || idata.avatar_url || null;
        const profile_url = idata.url || idata.profile || null;
        await supabase.from('user_social_accounts').upsert({
          user_id: user.id,
          provider,
          external_user_id: (ident as any).id || null,
          handle,
          avatar_url: avatar,
          profile_url,
        }, { onConflict: 'user_id,provider' } as any);
        if (!avatarUrl && avatar && !adoptedAvatar) {
          await supabase.from('profiles').update({ avatar_url: avatar }).eq('user_id', user.id);
          setAvatarUrl(avatar);
          adoptedAvatar = true;
        }
      }
    })();
  }, [user?.id]);

  // Autosave draft (kept for resilience)
  useEffect(() => {
    if (!user || loading) return;
    const timer = setTimeout(async () => {
      const draft = {
        fullName,
        avatarUrl,
        country,
        tz,
        languages,
        otherLanguage,
        primarySpecialty,
        examInterests,
        otherExam,
        years,
        position,
        hospital,
        bio,
        showProfilePublic,
        showSocialsPublic,
        linkedinUrl,
        twitterUrl,
      };
      await supabase.from('profiles').update({ onboarding_progress: draft }).eq('user_id', user.id);
    }, 600);
    return () => clearTimeout(timer);
  }, [user?.id, loading, fullName, avatarUrl, country, tz, languages, otherLanguage, primarySpecialty, examInterests, otherExam, years, position, hospital, bio, showProfilePublic, showSocialsPublic, linkedinUrl, twitterUrl]);

  const toggleChip = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const step1Valid = true;
  const step2Valid = true;
  const step3Valid = true;

  const next = () => {};
  const prev = () => {};

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false, contentType: file.type });
    if (error) { toast({ title: 'Avatar upload failed' }); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;
    setAvatarUrl(url);
    await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
  };

  const onConnect = async (provider: 'linkedin_oidc' | 'twitter') => {
    if (!user) return;
    const redirectUrl = `${window.location.origin}/onboarding`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl } as any });
    if (error) toast({ title: `Could not start ${provider} connect` });
  };

  const onFinish = async () => {
    if (!user) return;
    if (!(step1Valid && step2Valid && step3Valid)) { toast({ title: 'Please complete all required fields.' }); return; }
    try {
      setSaving(true);
      const finalExams = examInterests.filter(e => e !== 'Other').concat(otherExam.trim() ? [otherExam.trim()] : []);
      const finalLangs = languages.filter(l => l !== 'Other').concat(otherLanguage.trim() ? [otherLanguage.trim()] : []);
      const payload: any = {
        full_name: fullName,
        avatar_url: avatarUrl,
        country,
        timezone: tz,
        languages: finalLangs,
        primary_specialty: primarySpecialty,
        exam_interests: finalExams,
        years_experience: years === "" ? null : Number(years),
        position,
        hospital,
        bio,
        show_profile_public: showProfilePublic,
        show_socials_public: showSocialsPublic,
        onboarding_required: false,
        onboarding_progress: {},
        // Keep legacy fields in sync for compatibility
        specialty: primarySpecialty,
        exams: finalExams,
        linkedin: linkedinUrl || null,
        twitter: twitterUrl || null,
      };
      const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Welcome aboard! Profile completed.' });
      window.location.href = `/profile`;
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] pb-[env(safe-area-inset-bottom)]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Complete your profile</h1>
        <p className="text-muted-foreground">Just the essentials to get started. You can refine details anytime in your Profile.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-1">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Avatar</Label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files && uploadAvatar(e.target.files[0])} />
            {avatarUrl && <img src={avatarUrl} alt="Avatar preview" className="h-16 w-16 rounded-full object-cover" />}
          </div>
          <div className="grid gap-1">
            <Label>Country *</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {countries.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Timezone *</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {timezones.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-1">
            <Label>Primary specialty *</Label>
            <Select value={primarySpecialty} onValueChange={setPrimarySpecialty}>
              <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {specialties.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Exam interests *</Label>
            <div className="flex flex-wrap gap-2">
              {examOptions.map(e => (
                <Badge key={e} variant={examInterests.includes(e) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleChip(examInterests, setExamInterests, e)}>
                  {e}
                </Badge>
              ))}
            </div>
            {examInterests.includes('Other') && (
              <div className="grid gap-1 pt-2">
                <Label>Other exam</Label>
                <Input value={otherExam} onChange={(e) => setOtherExam(e.target.value)} placeholder="Enter other exam" />
              </div>
            )}
          </div>
          <div className="grid gap-1">
            <Label>Languages *</Label>
            <div className="flex flex-wrap gap-2">
              {languageOptions.map(l => (
                <Badge key={l} variant={languages.includes(l) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleChip(languages, setLanguages, l)}>
                  {l}
                </Badge>
              ))}
            </div>
            {languages.includes('Other') && (
              <div className="grid gap-1 pt-2">
                <Label>Other language</Label>
                <Input value={otherLanguage} onChange={(e) => setOtherLanguage(e.target.value)} placeholder="Enter other language" />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onFinish} disabled={saving || !step3Valid}>{saving ? 'Saving…' : 'Finish'}</Button>
      </div>
    </main>
  );
}
