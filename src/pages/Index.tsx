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

  // TEMP: one-time seed AI embeddings with small limit
  useEffect(() => {
    const run = async () => {
      try {
        const key = 'ai_seed_200_done';
        if (localStorage.getItem(key)) return;
        toast.message('Seeding AI embeddings (limit 200)...');
        const { data, error } = await supabase.functions.invoke('seed_ai_embeddings_once', {
          body: { limit: 200 },
        });
        if (error) throw error;
        console.log('AI_SEED_RESULT', data);
        toast.success(`Seeded ${data?.docs_embedded || 0} docs / ${data?.chunks_created || 0} chunks`);
        localStorage.setItem(key, '1');
      } catch (e: any) {
        console.error('AI seed failed', e);
        toast.error(`AI seed failed: ${e?.message || 'Unknown error'}`);
      }
    };
    run();
  }, []);

  return (
    <main>
      <Hero />
      <Features />
      <Pricing />
    </main>
  );
};

export default Index;
