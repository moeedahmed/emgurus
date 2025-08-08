import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import type { Guru } from "./GuruCard";
import { toast } from "@/components/ui/use-toast";

const SUPABASE_EDGE = "https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/consultations-api";

type Slot = { start: string; end: string };


export function BookingModal({ guru, open, onOpenChange }: {
  guru: Guru | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { session, signInWithGoogle } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !guru?.id) return;
    setSelectedSlot(null);

    // fetch availability for next 14 days
    const from = format(new Date(), "yyyy-MM-dd");
    const to = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    const url = `${SUPABASE_EDGE}/api/gurus/${guru.id}/availability?from=${from}&to=${to}`;
    setLoading(true);
    fetch(url, { headers: { "Content-Type": "application/json" } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load availability");
        const data: any = await r.json();
        // Use slots if present; otherwise derive empty list
        const normalized = (data?.slots || []).map((s: any) => ({ start: s.start, end: s.end }));
        setSlots(normalized);
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "Could not load availability", description: "Please try again later." });
      })
      .finally(() => setLoading(false));
  }, [open, guru?.id]);

  const confirmBooking = async () => {
    if (!guru || !selectedSlot) return;
    if (!session) {
      toast({ title: "Sign in required", description: "Please sign in to confirm your booking." });
      return;
    }
    try {
      setLoading(true);
      // 1) Create pending booking
      const res = await fetch(`${SUPABASE_EDGE}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          guru_id: guru.id,
          start_datetime_utc: selectedSlot.start,
          end_datetime_utc: selectedSlot.end,
          // communication_method intentionally omitted to avoid enum mismatches
          notes: name && email ? `Guest details: ${name} <${email}>` : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { booking } = await res.json();
      if (!booking?.id) throw new Error("Invalid booking response");

      // Free consultations: instantly confirmed by API
      if (!guru.price_per_30min || Number(guru.price_per_30min) <= 0) {
        toast({ title: "Free consultation confirmed" });
        onOpenChange(false);
        return;
      }

      // 2) Create Stripe checkout session
      const pay = await fetch(`${SUPABASE_EDGE}/api/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: booking.id, provider: "stripe" }),
      });
      if (!pay.ok) throw new Error(await pay.text());
      const { checkout_url } = await pay.json();
      if (!checkout_url) throw new Error("Failed to create checkout session");

      toast({ title: "Redirecting to secure payment" });
      window.open(checkout_url, "_blank");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      const msg = typeof e?.message === 'string' ? e.message : 'Please try again.';
      toast({ title: "Payment could not be processed", description: msg });
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
            <div className="space-y-2">
              <div className="font-medium">Next available (14 days)</div>
              <div className="max-h-72 overflow-auto grid gap-2">
                {slots.length > 0 ? (
                  slots
                    .filter((s) => {
                      const now = Date.now();
                      const start = new Date(s.start).getTime();
                      const max = Date.now() + 14 * 24 * 60 * 60 * 1000;
                      return start > now && start <= max;
                    })
                    .slice(0, 50)
                    .map((s) => (
                      <Button
                        key={s.start}
                        variant={selectedSlot?.start === s.start ? "default" : "outline"}
                        onClick={() => {
                          setSelectedSlot(s);
                        }}
                        className="justify-start"
                      >
                        {format(parseISO(s.start), "EEE MMM d, HH:mm")} – {format(parseISO(s.end), "HH:mm")}
                      </Button>
                    ))
                ) : (
                  <div className="text-sm text-muted-foreground">No upcoming slots found</div>
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
