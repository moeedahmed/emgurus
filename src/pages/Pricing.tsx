import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import Pricing from "@/components/Pricing";

export default function PricingPage() {
  useEffect(() => {
    document.title = "Pricing & Memberships | EMGurus";
    const desc = "Choose a plan and start instantly. Exams, Consultations, or Premium.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = `${window.location.origin}/pricing`;
  }, []);

  return (
    <main>
      <PageHero title="Membership & Pricing" subtitle="Pick the plan that unlocks what you need — upgrade anytime." align="center" />
      <Pricing />
    </main>
  );
}
