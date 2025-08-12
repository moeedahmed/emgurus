import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("");
  const [phone, setPhone] = useState("");
  const [hasPhoneColumn, setHasPhoneColumn] = useState<boolean>(false);
  const [hasNotifSettingsColumn, setHasNotifSettingsColumn] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<NotificationSettings>(defaultSettings);
  const [usingLocalPrefs, setUsingLocalPrefs] = useState<boolean>(false);

  // Determine default tab from URL: /settings/notifications or hash/query
  useEffect(() => {
    if (location.pathname.endsWith("/settings/notifications") || location.hash === "#notifications" || new URLSearchParams(location.search).get("tab") === "notifications") {
      setActiveTab("notifications");
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
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      const row = data as ProfileRowAny | null;
      setProfile(row);
      setFullName((row?.full_name as string) || "");
      setEmail((row?.email as string) || (user.email || ""));
      setTimezone((row?.timezone as string) || "");

      // Detect optional columns by presence in fetched row
      setHasPhoneColumn(Object.prototype.hasOwnProperty.call(row || {}, 'phone'));
      setHasNotifSettingsColumn(Object.prototype.hasOwnProperty.call(row || {}, 'notification_settings'));

      if (Object.prototype.hasOwnProperty.call(row || {}, 'phone')) {
        setPhone((row?.phone as string) || "");
      } else {
        // Try local fallback for phone
        const localPhone = localStorage.getItem('emg:phone') || "";
        setPhone(localPhone);
      }

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

  const canShowSmsToggle = useMemo(() => {
    return (hasPhoneColumn && !!phone) || (!!phone && usingLocalPrefs);
  }, [hasPhoneColumn, phone, usingLocalPrefs]);

  const saveProfile = async () => {
    if (!user) return;
    try {
      const updates: any = {
        full_name: fullName,
        timezone: timezone || null,
      };
      if (hasPhoneColumn) {
        updates.phone = phone || null;
      } else {
        // store locally if server column missing
        localStorage.setItem('emg:phone', phone || "");
      }
      const { error } = await supabase.from('profiles').update(updates as any).eq('user_id', user.id);
      if (error) {
        toast({ title: 'Could not save profile', description: error.message });
        return;
      }
      toast({ title: 'Profile saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message });
    }
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
      <article className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground mb-4">Manage your profile and how we notify you.</p>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1 md:col-span-2">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Email</Label>
                  <Input value={email} disabled />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Timezone</Label>
                  <Input placeholder="e.g., Europe/London" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label>Phone (optional)</Label>
                  <Input placeholder="+44 7700 900000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  {!hasPhoneColumn && (
                    <p className="text-xs text-muted-foreground">Stored locally for now — not yet saved to your account.</p>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={saveProfile}>Save Profile</Button>
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
                        toast({ title: 'Add your phone number first', description: 'Add your phone on the Profile tab.' });
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
