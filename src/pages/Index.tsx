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

  // TEMP: orchestrate AI seeding + search + refresh
  useEffect(() => {
    (async () => {
      try {
        const key = 'ai_seed_200_done_v2';
        if (localStorage.getItem(key)) return;
        toast.message('Seeding AI embeddings (limit 200)...');

        const seedOnce = async () => {
          const { data, error } = await supabase.functions.invoke('seed_ai_embeddings_once', { body: { limit: 200 } });
          if (error) throw error;
          console.log('AI_SEED_RESULT', data);
          return data as any;
        };

        const countIndex = async () => {
          const { count, error } = await supabase.from('ai_content_index').select('*', { head: true, count: 'exact' });
          if (error) throw error;
          console.log('AI_INDEX_COUNT', count);
          return count || 0;
        };

        let summary = await seedOnce();
        let totalCount = await countIndex();

        if ((summary?.docs_embedded || 0) === 0) {
          console.log('AI_SEED_DEMO_BLOGS_START');
          const { data: demoRes, error: demoErr } = await supabase.functions.invoke('seed-demo-blogs', { body: { count: 5 } });
          if (demoErr) throw demoErr;
          console.log('AI_SEED_DEMO_BLOGS', demoRes);
          // re-run seed after creating demo content
          summary = await seedOnce();
          totalCount = await countIndex();
        }

        // Search for "sepsis"
        const { data: searchRes, error: searchErr } = await supabase.functions.invoke('ai-search', {
          body: { query: 'sepsis', match_count: 3 },
        });
        if (searchErr) throw searchErr;
        console.log('AI_SEARCH_RESULTS', searchRes);

        // If looks valid, trigger refresh
        if (Array.isArray(searchRes?.results) && searchRes.results.length > 0) {
          const { data: refreshRes, error: refreshErr } = await supabase.functions.invoke('refresh_ai_embeddings', { body: { limit: 200 } });
          if (refreshErr) throw refreshErr;
          console.log('AI_REFRESH_RESULT', refreshRes);
        }

        toast.success(`Seeded ${summary?.docs_embedded || 0} docs / ${summary?.chunks_created || 0} chunks (index: ${totalCount})`);
        localStorage.setItem(key, '1');
      } catch (e: any) {
        console.error('AI orchestration failed', e);
        toast.error(`AI orchestration failed: ${e?.message || 'Unknown error'}`);
      }
    })();
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
