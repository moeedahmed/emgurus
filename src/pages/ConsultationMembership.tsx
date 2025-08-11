import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function ConsultationMembership() {
  useEffect(() => {
    document.title = "Consultation Membership | EMGurus";
  }, []);

  const startCheckout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = "/auth";
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-payment', { body: { tier: 'consultation', mode: 'subscription' } });
    if (error) return alert(error.message || 'Failed to start checkout');
    if (data?.url) window.open(data.url, '_blank');
  };

  return (
    <main>
      <PageHero title="Consultation monthly membership" subtitle="Unlock unlimited consultations with our mentors." align="center" />
      <section className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <p className="text-muted-foreground">Subscribe to make all consultations free at the point of booking. Cancel anytime.</p>
          <Button size="lg" onClick={startCheckout}>Start subscription</Button>
        </div>
      </section>
    </main>
  );
}
