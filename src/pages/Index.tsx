import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();

  useEffect(() => {
    const run = async () => {
      try {
        if (!user) return;
        const ran = localStorage.getItem('emg_import_done');
        if (ran) return;
        const { data, error } = await supabase.functions.invoke('import-emgurus', {
          body: { url: 'https://emgurus.com', limit: 20 },
        });
        if (error) throw error;
        toast.success(`Imported ${data?.imported || 0} articles`);
        localStorage.setItem('emg_import_done', '1');
      } catch (e) {
        console.error('Auto import failed', e);
      }
    };
    run();
  }, [user]);

  return (
    <main>
      <Hero />
      <Features />
      <Pricing />
    </main>
  );
};

export default Index;
