import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import TagInput from "@/components/forms/TagInput";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin, Twitter, Github, Facebook, Instagram, Youtube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";

interface ProfileRowAny {
  [key: string]: any;
}

type ChannelPrefs = {
  inapp: boolean; // always true in UI
  email: boolean;
  sms: boolean;
};

type BlogPrefs = {
  assignments: boolean;
  approvals: boolean;
  rejections: boolean;
  published: boolean;
};

type NotificationSettings = {
  channels: ChannelPrefs;
  categories: {
    blogs: BlogPrefs;
    system?: { general: boolean };
    exams?: any; // reserved for future
  };
};

const defaultSettings: NotificationSettings = {
  channels: { inapp: true, email: true, sms: false },
  categories: {
    blogs: { assignments: true, approvals: true, rejections: true, published: true },
    system: { general: true },
  },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<string>("profile");
  const [profile, setProfile] = useState<ProfileRowAny | null>(null);
  const [hasNotifSettingsColumn, setHasNotifSettingsColumn] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<NotificationSettings>(defaultSettings);
  const [usingLocalPrefs, setUsingLocalPrefs] = useState<boolean>(false);
  
  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Profile form state
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
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  // Determine tab from URL: #profile, #notifications, #security
  useEffect(() => {
    const hash = location.hash.slice(1); // Remove #
    if (hash === "profile" || hash === "notifications" || hash === "security") {
      setActiveTab(hash);
    } else if (location.pathname.endsWith("/settings/security") || new URLSearchParams(location.search).get("tab") === "security") {
      setActiveTab("security");
    } else if (hash === "" && location.pathname === "/profile") {
      // Coming from /profile redirect
      setActiveTab("profile");
    }
  }, [location.pathname, location.hash, location.search]);

  useEffect(() => {
    document.title = "Settings | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'Manage your profile and notification preferences.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, timezone, country, specialty, primary_specialty, avatar_url, cover_image_url, exams, exam_interests, languages, bio, linkedin, twitter, github, facebook, instagram, youtube, price_per_30min, position, hospital, onboarding_progress, notification_settings, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      const row = data as ProfileRowAny | null;
      setProfile(row);

      // Initialize profile form state
      if (row) {
        setFullName(row.full_name || '');
        setCountry(row.country || '');
        setTz(row.timezone || '');
        setPrimarySpecialty(row.primary_specialty || row.specialty || '');
        setExamInterests((row.exam_interests || row.exams || []) as string[]);
        setLanguages((row.languages || []) as string[]);
        setBio(row.bio || '');
        setPositionText(row.position || '');
        setHospitalText(row.hospital || '');
        setLinkedinUrl(row.linkedin || '');
        setTwitterUrl(row.twitter || '');
        setGithubUrl(row.github || '');
        setFacebookUrl(row.facebook || '');
        setInstagramUrl(row.instagram || '');
        setYoutubeUrl(row.youtube || '');
        setAvatarInput(row.avatar_url || '');
        setPhoneInput(row.phone || '');
      }

      // Detect optional columns by presence in fetched row
      setHasNotifSettingsColumn(Object.prototype.hasOwnProperty.call(row || {}, 'notification_settings'));

      // Load preferences: server first, else local, else defaults
      let loaded: NotificationSettings | null = null;
      if (row && Object.prototype.hasOwnProperty.call(row, 'notification_settings') && row?.notification_settings) {
        loaded = { ...defaultSettings, ...(row.notification_settings as NotificationSettings) };
        setUsingLocalPrefs(false);
      } else {
        const raw = localStorage.getItem('emg:notification_settings');
        if (raw) {
          try {
            loaded = { ...defaultSettings, ...(JSON.parse(raw) as any) };
            setUsingLocalPrefs(true);
          } catch {}
        }
      }
      setPrefs(loaded || defaultSettings);
    })();
  }, [user?.id]);

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

  const canShowSmsToggle = useMemo(() => {
    // Check if phone is available in profile data or localStorage
    const phoneFromProfile = profile?.phone || "";
    const phoneFromLocal = localStorage.getItem('emg:phone') || "";
    return !!(phoneFromProfile || phoneFromLocal);
  }, [profile?.phone]);

  // Social connect helpers
  const onConnect = async (provider: "linkedin_oidc" | "twitter" | "github" | "facebook") => {
    const redirectUrl = `${window.location.origin}/settings#profile`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: redirectUrl } as any });
    if (error) toast({ title: `Could not start ${provider} connect` });
  };

  const handleSaveProfile = async () => {
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
        github: githubUrl || null,
        facebook: facebookUrl || null,
        instagram: instagramUrl || null,
        youtube: youtubeUrl || null,
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

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { 
      toast({ title: "Could not update password", description: error.message }); 
      return; 
    }
    toast({ title: "Password updated" });
    setNewPassword(""); 
    setConfirmPassword("");
  };

  const saveNotifications = async () => {
    if (!user) return;
    try {
      if (hasNotifSettingsColumn) {
        const payload: any = { notification_settings: prefs };
        const { error } = await supabase.from('profiles').update(payload as any).eq('user_id', user.id);
        if (error) { throw error; }
        setUsingLocalPrefs(false);
      } else {
        localStorage.setItem('emg:notification_settings', JSON.stringify(prefs));
        setUsingLocalPrefs(true);
      }
      toast({ title: 'Notification preferences saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message });
    }
  };

  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <article className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground mb-4">Manage your profile, notifications, and security settings.</p>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <div className="space-y-6">
              {/* Profile Picture */}
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Profile Picture</h2>
                    <div className="flex items-center gap-4 flex-wrap">
                      {(avatarInput || profile?.avatar_url) && (
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={avatarInput || profile?.avatar_url} alt="Profile picture" />
                          <AvatarFallback>{fullName?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="space-y-2">
                        <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }} disabled={uploadingAvatar} />
                        <div className="flex gap-2">
                          <Input placeholder="Or paste image URL" value={avatarInput} onChange={(e) => setAvatarInput(e.target.value)} />
                          <Button type="button" onClick={applyAvatarUrl} disabled={!avatarInput}>Apply</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Basic Information */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Basic Information</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Full name</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary specialty</Label>
                      <TagInput value={primarySpecialty ? [primarySpecialty] : []} onChange={(vals) => setPrimarySpecialty(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type specialty" />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <TagInput value={country ? [country] : []} onChange={(vals) => setCountry(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type country" />
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <TagInput value={tz ? [tz] : []} onChange={(vals) => setTz(vals[0] || '')} suggestions={[]} maxTags={1} placeholder="Type timezone (e.g., Europe/London)" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Exam interests</Label>
                      <TagInput value={examInterests} onChange={setExamInterests} suggestions={[]} placeholder="Type exams and press Enter" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Languages</Label>
                      <TagInput value={languages} onChange={setLanguages} suggestions={[]} placeholder="Type languages and press Enter" />
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                </div>
              </Card>

              {/* Professional Information */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Professional Information</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <TagInput value={[positionText].filter(Boolean)} onChange={(tags) => setPositionText(tags[0] || "")} suggestions={["Registrar","Consultant","Senior Registrar","House Officer","Medical Officer","Specialist","Resident"]} placeholder="Add positions (e.g., Registrar, Consultant)" maxTags={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Employer</Label>
                      <TagInput value={[hospitalText].filter(Boolean)} onChange={(tags) => setHospitalText(tags[0] || "")} suggestions={["NHS","Private Practice","University Hospital","General Hospital","Emergency Department"]} placeholder="Add employers/institutions" maxTags={1} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Bio</Label>
                      <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                </div>
              </Card>

              {/* Social Links */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Social Accounts</h2>
                  <div className="space-y-4">
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="instagram">Instagram URL</Label>
                        <Input id="instagram" placeholder="https://instagram.com/yourhandle" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="youtube">YouTube URL</Label>
                        <Input id="youtube" placeholder="https://youtube.com/@yourchannel" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Connect accounts (preferred). For platforms without login, you can add links.</p>
                  </div>
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                </div>
              </Card>

              {/* Phone Verification */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Phone Verification</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number</Label>
                      <Input 
                        id="phone"
                        type="tel" 
                        placeholder="+1234567890" 
                        value={phoneInput} 
                        onChange={(e) => setPhoneInput(e.target.value)}
                        disabled={phoneVerified}
                      />
                    </div>
                    {!phoneVerified && !phoneOtpSent && (
                      <Button onClick={sendPhoneOtp} disabled={isVerifyingPhone || !phoneInput}>
                        {isVerifyingPhone ? "Sending..." : "Send verification code"}
                      </Button>
                    )}
                    {phoneOtpSent && !phoneVerified && (
                      <div className="space-y-2">
                        <Label htmlFor="otp">Verification code</Label>
                        <Input 
                          id="otp"
                          placeholder="123456" 
                          value={phoneOtpCode} 
                          onChange={(e) => setPhoneOtpCode(e.target.value)}
                          maxLength={6}
                        />
                        <Button onClick={verifyPhoneOtp} disabled={isVerifyingPhone || !phoneOtpCode}>
                          {isVerifyingPhone ? "Verifying..." : "Verify phone"}
                        </Button>
                      </div>
                    )}
                    {phoneVerified && (
                      <div className="text-sm text-green-600">✅ Phone number verified</div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <Card className="p-6 space-y-4 max-w-xl">
              <div>
                <h2 className="text-lg font-semibold mb-4">Change Password</h2>
                <div className="grid gap-4">
                  <div className="grid gap-1">
                    <Label htmlFor="new-password">New password</Label>
                    <Input 
                      id="new-password"
                      type="password" 
                      placeholder="Enter new password"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input 
                      id="confirm-password"
                      type="password" 
                      placeholder="Confirm new password"
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                    />
                  </div>
                  <Button onClick={handleChangePassword}>Update Password</Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card className="p-6 space-y-5">
              <div className="text-sm text-muted-foreground">We’ll always show in-app toasts. Email/SMS are optional.</div>
              {usingLocalPrefs && (
                <div className="text-xs text-muted-foreground">Preferences are not saved to your account yet. They’ll only apply on this device.</div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">In-app</div>
                    <div className="text-xs text-muted-foreground">Always enabled</div>
                  </div>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-xs text-muted-foreground">Get emails for important updates</div>
                  </div>
                  <Switch
                    checked={prefs.channels.email}
                    onCheckedChange={(v) => setPrefs({ ...prefs, channels: { ...prefs.channels, email: !!v } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">SMS</div>
                    <div className="text-xs text-muted-foreground">Text messages for critical updates</div>
                  </div>
                  <Switch
                    checked={prefs.channels.sms}
                    disabled={!canShowSmsToggle}
                    onCheckedChange={(v) => {
                      if (!canShowSmsToggle && v) {
                        toast({ title: 'Add your phone number first', description: 'Add your phone number in your profile first.' });
                        return;
                      }
                      setPrefs({ ...prefs, channels: { ...prefs.channels, sms: !!v } });
                    }}
                  />
                </div>
              </div>
              <div className="pt-2">
                <div className="font-medium mb-2">Blogs</div>
                <div className="space-y-3">
                  {["assignments","approvals","rejections","published"].map((k) => (
                    <div key={k} className="flex items-center justify-between">
                      <div className="text-sm capitalize">{k}</div>
                      <Switch
                        checked={(prefs.categories.blogs as any)[k]}
                        onCheckedChange={(v) => setPrefs({
                          ...prefs,
                          categories: {
                            ...prefs.categories,
                            blogs: { ...prefs.categories.blogs, [k]: !!v } as BlogPrefs,
                          },
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={saveNotifications}>Save Preferences</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </article>
    </main>
  );
}
