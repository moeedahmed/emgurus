import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Suggestion = { label: string; prompt: string };

const presets: Record<string, Suggestion[]> = {
  consultations: [
    { label: 'Find a Guru', prompt: 'Find a suitable guru for my needs.' },
    { label: 'Show next slots', prompt: 'Show the next available time slots.' },
    { label: 'Pricing', prompt: 'What are typical consultation prices?' }
  ],
  blogs: [
    { label: 'Recommend related posts', prompt: 'Recommend related posts to this page.' },
    { label: 'Summarise this page', prompt: 'Summarise the key points of this page.' }
  ],
  exams: [
    { label: 'Start AI practice', prompt: 'Start AI exam practice.' },
    { label: 'Reviewed bank', prompt: 'Browse reviewed question bank.' },
    { label: 'Explain a topic', prompt: 'Explain this exam topic.' },
  ],
  forums: [
    { label: 'Search similar threads', prompt: 'Find similar forum threads.' },
    { label: 'Start a thread draft', prompt: 'Draft a new thread based on my question.' }
  ],
  default: [
    { label: 'What can you do?', prompt: 'What can you help me with on EM Gurus?' },
    { label: 'Find resources', prompt: 'Find relevant content for emergency medicine learners.' }
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const ctx = (url.searchParams.get('context') || 'default').toLowerCase();
  const list = presets[ctx] || presets.default;
  return new Response(JSON.stringify({ suggestions: list }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});