import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TP_API_KEY = Deno.env.get('TRUSTPILOT_API_KEY');
const TP_BUSINESS_UNIT_ID = Deno.env.get('TRUSTPILOT_BUSINESS_UNIT_ID');

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${TP_API_KEY}` } });
  if (!res.ok) throw new Error(`Trustpilot API error: ${res.status}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!TP_API_KEY || !TP_BUSINESS_UNIT_ID) {
    return new Response(JSON.stringify({
      error: 'Missing TRUSTPILOT_API_KEY or TRUSTPILOT_BUSINESS_UNIT_ID',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const base = `https://api.trustpilot.com/v1/business-units/${TP_BUSINESS_UNIT_ID}`;
    const info = await fetchJson(base);

    // Latest 5 reviews
    const reviewsRes = await fetchJson(`${base}/reviews?perPage=50&orderBy=createdat.desc`);
    const allReviews = reviewsRes?.reviews ?? reviewsRes?.data ?? [];

    const latest5 = allReviews.slice(0, 5).map((r: any) => ({
      reviewer: r?.consumer?.displayName ?? r?.consumerName ?? 'Anonymous',
      rating: r?.stars ?? r?.rating ?? 0,
      title: r?.title ?? '',
      text: r?.text ?? r?.content ?? '',
      createdAt: r?.createdAt || r?.createdAtISO || r?.dates?.publishedDateTime,
    }));

    // 30-day change
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const start30 = now - ms30;
    const prev30 = start30 - ms30;

    const countInRange = (arr: any[], start: number, end: number) =>
      arr.filter((r: any) => {
        const t = new Date(r?.createdAt || r?.dates?.publishedDateTime || r?.createdAtISO || 0).getTime();
        return t >= start && t < end;
      }).length;

    const last30 = countInRange(allReviews, start30, now);
    const prev30Cnt = countInRange(allReviews, prev30, start30);
    const pctChange = prev30Cnt === 0 ? (last30 > 0 ? 100 : 0) : Math.round(((last30 - prev30Cnt) / prev30Cnt) * 100);

    const totalReviews = info?.numberOfReviews?.total || info?.numberOfReviews || info?.stats?.reviewsCount || 0;
    const averageRating = info?.score?.trustScore || info?.stars || info?.score || 0;

    return new Response(JSON.stringify({
      totalReviews,
      averageRating,
      latest5,
      last30,
      prev30: prev30Cnt,
      pctChange,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('trustpilot-analytics error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});