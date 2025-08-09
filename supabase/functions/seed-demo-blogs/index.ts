import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { count: existingCount } = await supabase
      .from('blog_posts')
      .select('*', { head: true, count: 'exact' })
      .eq('status', 'published');

    if ((existingCount || 0) > 0) {
      return new Response(JSON.stringify({ inserted: 0, total_published_after: existingCount }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const now = new Date().toISOString();
    const uid = crypto.randomUUID();

    const sample = [
      {
        title: 'Recognizing Sepsis Early: Key Signs and Rapid Management',
        slug: 'recognizing-sepsis-early',
        content: 'Sepsis is a life-threatening organ dysfunction caused by a dysregulated host response to infection. Early recognition and prompt antibiotics save lives. This post discusses qSOFA, lactate, and source control. Keyword: sepsis.',
        tags: ['sepsis', 'critical-care', 'emergency-medicine'],
      },
      {
        title: 'Airway Pearls for the Emergency Physician',
        slug: 'airway-pearls-emergency',
        content: 'Key principles of airway assessment, preoxygenation, RSI, and rescue strategies for difficult airways.',
        tags: ['airway', 'emergency-medicine'],
      },
      {
        title: 'Managing Septic Shock: Fluids, Pressors, and Pitfalls',
        slug: 'managing-septic-shock',
        content: 'Initial fluid resuscitation, vasopressor selection (norepinephrine first), and avoiding delays in source control. Contains keyword: sepsis.',
        tags: ['sepsis', 'shock', 'critical-care'],
      },
      {
        title: 'Rapid Atrial Fibrillation in the ED',
        slug: 'rapid-afib-ed',
        content: 'Approach to rate vs rhythm control, anticoagulation considerations, and when to cardiovert.',
        tags: ['cardiology', 'arrhythmia'],
      },
      {
        title: 'Trauma Primary Survey: ATLS Refresher',
        slug: 'trauma-primary-survey',
        content: 'ABCDE approach, hemorrhage control, imaging strategies, and performance under pressure.',
        tags: ['trauma', 'ATLS', 'emergency-medicine'],
      }
    ].map((p) => ({
      ...p,
      status: 'published',
      created_at: now,
      updated_at: now,
      author_id: uid,
    }));

    const { error } = await supabase.from('blog_posts').insert(sample as any);
    if (error) throw error;

    const { count: afterCount } = await supabase
      .from('blog_posts')
      .select('*', { head: true, count: 'exact' })
      .eq('status', 'published');

    return new Response(JSON.stringify({ inserted: sample.length, total_published_after: afterCount || 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('seed-demo-blogs error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});