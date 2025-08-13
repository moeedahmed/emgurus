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

  const [activeTab, setActiveTab] = useState<string>("notifications");
  const [profile, setProfile] = useState<ProfileRowAny | null>(null);
  const [hasNotifSettingsColumn, setHasNotifSettingsColumn] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<NotificationSettings>(defaultSettings);
  const [usingLocalPrefs, setUsingLocalPrefs] = useState<boolean>(false);
  
  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Determine default tab from URL: /settings/security or hash/query
  useEffect(() => {
    if (location.pathname.endsWith("/settings/security") || location.hash === "#security" || new URLSearchParams(location.search).get("tab") === "security") {
      setActiveTab("security");
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

  const canShowSmsToggle = useMemo(() => {
    // Check if phone is available in profile data or localStorage
    const phoneFromProfile = profile?.phone || "";
    const phoneFromLocal = localStorage.getItem('emg:phone') || "";
    return !!(phoneFromProfile || phoneFromLocal);
  }, [profile?.phone]);

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
      <article className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground mb-4">Manage your notifications and security settings.</p>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

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
