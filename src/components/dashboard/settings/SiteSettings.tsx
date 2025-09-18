import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function SiteSettings() {
  const { user, loading: userLoading } = useAuth();
  const [settings, setSettings] = useState({
    siteName: 'EM Gurus',
    siteDescription: 'Emergency Medicine education platform',
    maintenanceMode: false,
    registrationEnabled: true,
    featuredContent: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading settings…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to manage settings.</div>;
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Settings Saved",
        description: "Site settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Site Settings</h2>
        
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={settings.siteName}
              onChange={(e) => setSettings(prev => ({ ...prev, siteName: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea
              id="siteDescription"
              value={settings.siteDescription}
              onChange={(e) => setSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="featuredContent">Featured Content</Label>
            <Textarea
              id="featuredContent"
              value={settings.featuredContent}
              onChange={(e) => setSettings(prev => ({ ...prev, featuredContent: e.target.value }))}
              placeholder="HTML content for featured sections..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">Put the site in maintenance mode</p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maintenanceMode: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>User Registration</Label>
              <p className="text-sm text-muted-foreground">Allow new user registrations</p>
            </div>
            <Switch
              checked={settings.registrationEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, registrationEnabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="w-full">
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}