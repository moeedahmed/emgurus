import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TagInput from "@/components/forms/TagInput";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Linkedin, Twitter, Github, Facebook, Instagram, Youtube } from "lucide-react";
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
  github?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
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

const [githubUrl, setGithubUrl] = useState("");
const [facebookUrl, setFacebookUrl] = useState("");
const [instagramUrl, setInstagramUrl] = useState("");
const [youtubeUrl, setYoutubeUrl] = useState("");
const [avatarInput, setAvatarInput] = useState("");
const [uploadingAvatar, setUploadingAvatar] = useState(false);

// Phone verification
// Phone verification
const [phoneInput, setPhoneInput] = useState("");
const [phoneOtpSent, setPhoneOtpSent] = useState(false);
const [phoneOtpCode, setPhoneOtpCode] = useState("");
const [phoneVerified, setPhoneVerified] = useState(false);
const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  // Social connect helpers
  const onConnect = async (provider: "linkedin_oidc" | "twitter" | "github" | "facebook") => {
    const redirectUrl = `${window.location.origin}/profile`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: redirectUrl } as any });
    if (error) toast({ title: `Could not start ${provider} connect` });
  };

  useEffect(() => {
    document.title = "My Profile | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'Edit your profile information.');
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
        .select('user_id, full_name, email, timezone, country, specialty, primary_specialty, avatar_url, cover_image_url, exams, exam_interests, languages, bio, linkedin, twitter, github, facebook, instagram, youtube, price_per_30min, position, hospital, onboarding_progress')
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
      setGithubUrl(row?.github || '');
      setFacebookUrl(row?.facebook || '');
      setInstagramUrl(row?.instagram || '');
      setYoutubeUrl(row?.youtube || '');
      setAvatarInput(row?.avatar_url || '');
      setPhoneInput(row?.phone || '');

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
        phone: phoneVerified ? phoneInput : null,
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


  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    try {
      setUploadingAvatar(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl;
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      setAvatarInput(url);
      setProfile(p => p ? ({ ...p, avatar_url: url }) : p);
      toast({ title: 'Avatar updated' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const applyAvatarUrl = async () => {
    if (!user) return;
    try {
      if (!avatarInput) { toast({ title: 'Enter an image URL' }); return; }
      await supabase.from('profiles').update({ avatar_url: avatarInput }).eq('user_id', user.id);
      setProfile(p => p ? ({ ...p, avatar_url: avatarInput }) : p);
      toast({ title: 'Avatar updated' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message });
    }
  };

  const sendPhoneOtp = async () => {
    if (!phoneInput || phoneInput.length < 10) {
      toast({ title: "Invalid phone number", description: "Please enter a valid phone number." });
      return;
    }
    setIsVerifyingPhone(true);
    try {
      // Mock OTP sending - in real implementation, you'd call an SMS service
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhoneOtpSent(true);
      toast({ title: "OTP sent", description: "Check your phone for the verification code." });
    } catch (e: any) {
      toast({ title: "Failed to send OTP", description: e.message });
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!phoneOtpCode || phoneOtpCode.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter the 6-digit verification code." });
      return;
    }
    setIsVerifyingPhone(true);
    try {
      // Mock OTP verification - in real implementation, you'd verify with SMS service
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (phoneOtpCode === "123456") { // Mock verification
        setPhoneVerified(true);
        setPhoneOtpSent(false);
        setPhoneOtpCode("");
        toast({ title: "Phone verified", description: "Your phone number has been verified successfully." });
      } else {
        toast({ title: "Invalid code", description: "The verification code is incorrect." });
      }
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message });
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <article className="max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs header removed - single profile page */}

          {/* PROFILE EDIT */}
          <TabsContent value="profile" className="mt-4">
            <Card className="w-full overflow-hidden p-6 shadow-md space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Profile picture</Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {(avatarInput || profile?.avatar_url) ? (
                      <img src={(avatarInput || (profile?.avatar_url as string))} alt="Avatar preview" className="h-16 w-16 rounded-full object-cover" />
                    ) : null}
                    <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }} disabled={uploadingAvatar} />
                    <div className="flex gap-2 w-full md:w-auto">
                      <Input placeholder="Avatar image URL" value={avatarInput} onChange={(e) => setAvatarInput(e.target.value)} />
                      <Button type="button" onClick={applyAvatarUrl} disabled={!avatarInput}>Apply</Button>
                    </div>
                  </div>
                </div>
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
                    <Button variant="outline" onClick={() => onConnect('github')} disabled={!!githubUrl} className="inline-flex items-center gap-2">
                      <Github className="h-4 w-4" /> {githubUrl ? 'GitHub connected' : 'Connect GitHub'}
                    </Button>
                    <Button variant="outline" onClick={() => onConnect('facebook')} disabled={!!facebookUrl} className="inline-flex items-center gap-2">
                      <Facebook className="h-4 w-4" /> {facebookUrl ? 'Facebook connected' : 'Connect Facebook'}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 w-full mt-2">
                    <div className="grid gap-1">
                      <Label htmlFor="instagram">Instagram URL</Label>
                      <Input id="instagram" placeholder="https://instagram.com/yourhandle" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="youtube">YouTube URL</Label>
                      <Input id="youtube" placeholder="https://youtube.com/@yourchannel" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Connect accounts (preferred). For platforms without login, you can add links.</p>
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Phone number (optional)</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="+44 7700 900000" 
                        value={phoneInput} 
                        onChange={(e) => setPhoneInput(e.target.value)}
                        disabled={phoneVerified}
                      />
                      {!phoneVerified && !phoneOtpSent && (
                        <Button 
                          onClick={sendPhoneOtp} 
                          disabled={isVerifyingPhone || !phoneInput}
                          variant="outline"
                        >
                          {isVerifyingPhone ? "Sending..." : "Verify"}
                        </Button>
                      )}
                      {phoneVerified && (
                        <Button variant="outline" disabled>
                          ✓ Verified
                        </Button>
                      )}
                    </div>
                    {phoneOtpSent && !phoneVerified && (
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Enter 6-digit code" 
                          value={phoneOtpCode} 
                          onChange={(e) => setPhoneOtpCode(e.target.value)}
                          maxLength={6}
                        />
                        <Button 
                          onClick={verifyPhoneOtp} 
                          disabled={isVerifyingPhone || phoneOtpCode.length !== 6}
                        >
                          {isVerifyingPhone ? "Verifying..." : "Confirm"}
                        </Button>
                      </div>
                    )}
                    {phoneOtpSent && !phoneVerified && (
                      <p className="text-xs text-muted-foreground">
                        Enter the 6-digit code sent to your phone. (Use 123456 for demo)
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave}>Save changes</Button>
              </div>
            </Card>
          </TabsContent>

        </Tabs>
      </article>
    </main>
  );
}
