import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { format, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Guru } from "./GuruCard";
import { toast } from "@/components/ui/use-toast";

const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";

type Slot = {
  start: string; // ISO datetime
  end: string;   // ISO datetime
};

type AvailabilityResponse = {
  guru_id: string;
  slots: Slot[];
};

function toSlotsForDate(slots: Slot[], day: Date): Slot[] {
  return slots.filter((s) => {
    const sd = parseISO(s.start);
    return isSameDay(sd, day);
  });
}

export function BookingModal({ guru, open, onOpenChange }: {
  guru: Guru | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { session, signInWithGoogle } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const daySlots = useMemo(() => (selectedDate ? toSlotsForDate(slots, selectedDate) : []), [slots, selectedDate]);

  useEffect(() => {
    if (!open || !guru) return;
    // reset local state
    setSelectedDate(undefined);
    setSelectedSlot(null);

    // fetch availability for next 30 days
    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    const url = `${SUPABASE_EDGE}/api/gurus/${guru.id}/availability?start=${start}&end=${end}`;
    setLoading(true);
    fetch(url, { headers: { "Content-Type": "application/json" } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load availability");
        const data: AvailabilityResponse = await r.json();
        // Normalize potential shapes
        const normalized = (data?.slots || []).map((s) => ({ start: s.start, end: s.end }));
        setSlots(normalized);
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "Could not load availability", description: "Please try again later." });
      })
      .finally(() => setLoading(false));
  }, [open, guru]);

  const confirmBooking = async () => {
    if (!guru || !selectedSlot) return;
    if (!session) {
      toast({ title: "Sign in required", description: "Please sign in to confirm your booking." });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_EDGE}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          guru_id: guru.id,
          start_datetime: selectedSlot.start,
          end_datetime: selectedSlot.end,
          communication_method: "video",
          notes: name && email ? `Guest details: ${name} <${email}>` : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Booking created", description: "Check your dashboard for details." });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Booking failed", description: "Please retry in a moment." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book {guru?.full_name}</DialogTitle>
          <DialogDescription>
            {guru?.specialty} • {guru?.country} • {guru?.timezone || "Timezone not set"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start font-normal", !selectedDate && "text-muted-foreground")}> 
                  {selectedDate ? format(selectedDate, "PPP") : "Select a day"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={selectedDate} 
                  onSelect={setSelectedDate} 
                  initialFocus 
                  className={cn("p-3 pointer-events-auto")} 
                />
              </PopoverContent>
            </Popover>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Available times</div>
              <div className="grid grid-cols-2 gap-2">
                {selectedDate && daySlots.length > 0 ? (
                  daySlots.map((s) => (
                    <Button
                      key={s.start}
                      variant={selectedSlot?.start === s.start ? "default" : "outline"}
                      onClick={() => setSelectedSlot(s)}
                    >
                      {format(parseISO(s.start), "HH:mm")} – {format(parseISO(s.end), "HH:mm")}
                    </Button>
                  ))
                ) : (
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {selectedDate ? "No times this day" : "Pick a day to see times"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="font-medium">Summary</div>
              <div className="text-sm text-muted-foreground">
                {selectedSlot ? (
                  <>
                    {format(parseISO(selectedSlot.start), "PPP HH:mm")} • {guru?.price_per_30min ? `$${guru.price_per_30min}` : "Free"}
                  </>
                ) : (
                  "Select a time slot"
                )}
              </div>
            </div>

            {!session && (
              <div className="space-y-3">
                <div className="text-sm">Continue as guest (we'll still ask you to sign in to confirm)</div>
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="g-name">Name</Label>
                    <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="g-email">Email</Label>
                    <Input id="g-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
                  </div>
                  <Button variant="secondary" onClick={signInWithGoogle}>Sign in with Google</Button>
                </div>
              </div>
            )}

            <Button onClick={confirmBooking} disabled={!selectedSlot || loading}>
              {guru?.price_per_30min ? "Pay & Confirm" : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
