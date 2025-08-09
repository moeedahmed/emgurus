import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface TrustpilotStats {
  totalReviews: number;
  averageRating: number;
  latest5: { reviewer: string; rating: number; title: string; text: string; createdAt: string }[];
  last30: number;
  prev30: number;
  pctChange: number;
}

export default function TrustpilotAnalytics() {
  const [loading, setLoading] = useState(true);
  const [tp, setTp] = useState<TrustpilotStats | null>(null);
  const [inviteCount, setInviteCount] = useState<number>(0);
  const [emailEvents, setEmailEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tpResp, invitesRes, eventsRes] = await Promise.all([
          supabase.functions.invoke('trustpilot-analytics'),
          supabase.from('review_invitations').select('*', { count: 'exact', head: true }),
          supabase.from('email_events')
            .select('id, email, type, event, created_at')
            .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
        ]);

        const tpData = (tpResp as any)?.data;
        const tpErr = (tpResp as any)?.error;
        if (tpErr) throw tpErr;
        if ((tpData as any)?.error) throw new Error((tpData as any).error);

        setTp(tpData as TrustpilotStats);
        setInviteCount((invitesRes as any).count || 0);
        setEmailEvents((eventsRes as any).data || []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const emailStats = useMemo(() => {
    const welcome = emailEvents.filter(e => e.type === 'welcome');
    const invites = emailEvents.filter(e => e.type === 'review_invite');

    const calc = (arr: any[]) => {
      const sent = arr.filter(e => e.event === 'sent').length;
      const opened = arr.filter(e => e.event === 'opened').length;
      const clicked = arr.filter(e => e.event === 'clicked').length;
      const openRate = sent ? Math.round((opened / sent) * 100) : 0;
      const ctr = sent ? Math.round((clicked / sent) * 100) : 0;
      return { sent, opened, clicked, openRate, ctr };
    };

    return { welcome: calc(welcome), invites: calc(invites) };
  }, [emailEvents]);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">Trustpilot Analytics</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total reviews</div>
              <div className="text-2xl font-bold">{tp?.totalReviews ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Avg rating</div>
              <div className="text-2xl font-bold">{tp?.averageRating ?? '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">30d reviews</div>
              <div className="text-2xl font-bold">{tp?.last30 ?? 0}</div>
              <div className="text-xs text-muted-foreground">{tp?.pctChange ?? 0}% vs prev 30d</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Invites sent</div>
              <div className="text-2xl font-bold">{inviteCount}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Email: Welcome</h3>
              <p className="text-sm text-muted-foreground">Sent: {emailStats.welcome.sent} · Open rate: {emailStats.welcome.openRate}% · CTR: {emailStats.welcome.ctr}%</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Email: Review Invites</h3>
              <p className="text-sm text-muted-foreground">Sent: {emailStats.invites.sent} · Open rate: {emailStats.invites.openRate}% · CTR: {emailStats.invites.ctr}%</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Latest reviews</h3>
            <ul className="space-y-3">
              {(tp?.latest5 || []).map((r, idx) => (
                <li key={idx} className="text-sm">
                  <div className="font-medium">{r.reviewer} · {r.rating}★</div>
                  <div className="text-muted-foreground">{r.title || r.text?.slice(0, 120)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
