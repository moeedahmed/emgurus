import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ConsultationPricing() {
  const { user, loading: userLoading } = useAuth();
  const [pricing, setPricing] = useState({
    hourlyRate: '',
    currency: 'USD'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading pricing…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to manage pricing.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchPricing = async () => {
      try {
        // Simulate guru profile data
        const data = {
          hourly_rate: 150,
          currency: 'USD'
        };
        
        if (!cancelled && data) {
          setPricing({
            hourlyRate: data.hourly_rate?.toString() || '',
            currency: data.currency || 'USD'
          });
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      }
    };

    fetchPricing();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleSave = async () => {
    if (!pricing.hourlyRate || isNaN(Number(pricing.hourlyRate))) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid hourly rate.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: "Pricing Updated",
        description: "Your consultation pricing has been saved.",
      });
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save pricing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">Consultation Pricing</h2>
        <p className="text-sm text-muted-foreground">Set your hourly consultation rates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="hourlyRate">Hourly Rate</Label>
            <div className="flex gap-2">
              <Input
                id="hourlyRate"
                type="number"
                value={pricing.hourlyRate}
                onChange={(e) => setPricing(prev => ({ ...prev, hourlyRate: e.target.value }))}
                placeholder="100"
                min="0"
                step="0.01"
              />
              <div className="w-20">
                <Input value={pricing.currency} disabled />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? "Saving..." : "Save Pricing"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}