import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function GuruAvailability() {
  const { user, loading: userLoading } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading availability…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to manage availability.</div>;
  }

  useEffect(() => {
    let cancelled = false;
    
    const fetchSlots = async () => {
      try {
        setLoading(true);
        // Simulate availability data
        const data = Array.from({ length: 3 }, (_, i) => ({
          id: `slot-${i}`,
          start_time: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
          duration_minutes: 60,
          is_booked: i === 0
        }));
        
        if (!cancelled) {
          setSlots(data || []);
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
        if (!cancelled) {
          setSlots([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSlots();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="p-4">Loading availability...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">Availability Management</h2>
          
        </div>
        <Button onClick={() => window.open('/guru/availability', '_blank')}>
          Edit Availability
        </Button>
      </div>

      <div className="grid gap-4">
        {slots.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">No availability slots configured.</p>
              <Button onClick={() => window.open('/guru/availability', '_blank')}>
                Set Up Availability
              </Button>
            </CardContent>
          </Card>
        ) : (
          slots.map((slot) => (
            <Card key={slot.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {new Date(slot.start_time).toLocaleString()}
                  </CardTitle>
                  <Badge variant={slot.is_booked ? "secondary" : "default"}>
                    {slot.is_booked ? "Booked" : "Available"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  Duration: {slot.duration_minutes || 60} minutes
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}