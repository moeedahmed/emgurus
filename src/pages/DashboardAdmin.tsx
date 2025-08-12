import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, GraduationCap, BarChart3, UsersRound, Settings, Stethoscope } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import ForumsModeration from "@/pages/ForumsModeration";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useAdminMetrics } from "@/hooks/metrics/useAdminMetrics";
import ModeratePosts from "@/pages/admin/ModeratePosts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import Taxonomy from "@/pages/admin/Taxonomy";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import ExamsAICuration from "@/pages/admin/ExamsAICuration";
import SubmitQuestion from "@/pages/tools/SubmitQuestion";
import QuestionSetsAdmin from "@/pages/admin/QuestionSets";
import AdminConsultsOverview from "@/components/dashboard/consultations/AdminConsultsOverview";
import AdminConsultsBookings from "@/components/dashboard/consultations/AdminConsultsBookings";
import AdminConsultsGurus from "@/components/dashboard/consultations/AdminConsultsGurus";
import AdminConsultsPolicies from "@/components/dashboard/consultations/AdminConsultsPolicies";
import AdminConsultsNotifications from "@/components/dashboard/consultations/AdminConsultsNotifications";
import AdminConsultsSettings from "@/components/dashboard/consultations/AdminConsultsSettings";
import ApproveGurus from "@/pages/admin/ApproveGurus";

// -------- Analytics panel
const AdminAnalyticsPanel: React.FC = () => {
  const { kpis, submissionsSeries, isLoading } = useAdminMetrics();
  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="New Users (7d)" value={kpis.newUsers7d} isLoading={isLoading} />
      <KpiCard title="Posts Submitted (7d)" value={kpis.postsSubmitted7d} isLoading={isLoading} />
      <KpiCard title="Questions Pending" value={kpis.questionsPending} isLoading={isLoading} />
      <KpiCard title="Chat Error Rate (7d)" value={`${kpis.chatErrorRate7d}%`} isLoading={isLoading} />
      <div className="md:col-span-4">
        <TrendCard title="Submissions" series={submissionsSeries} rangeLabel="Last 28 days" isLoading={isLoading} />
      </div>
    </div>
  );
};

const AdminExamShortcutsBar: React.FC = () => (
  <div className="px-4 py-3 border-b flex flex-wrap gap-2">
    <Button asChild size="sm" variant="outline"><a href="/tools/submit-question">Submit Question</a></Button>
    <Button asChild size="sm" variant="outline"><a href="/admin/exams-curation">AI Curation & Assign</a></Button>
    <Button asChild size="sm" variant="outline"><a href="/admin/question-sets">Question Sets</a></Button>
    <Button asChild size="sm" variant="outline"><a href="/admin/marked-questions">Marked Questions</a></Button>
  </div>
);

// -------- Blogs tab components
const AdminSubmitted: React.FC = () => {
  return <ModeratePosts forceView="admin" forceTab="unassigned" />;
};

const AdminAssigned: React.FC = () => {
  return <ModeratePosts forceView="admin" forceTab="assigned" />;
};

const AdminReviewed: React.FC = () => {
  const [posts, setPosts] = useState<Array<{ id: string; title: string; description: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: list } = await supabase
          .from('blog_posts')
          .select('id,title,description,created_at')
          .eq('status', 'in_review')
          .order('created_at', { ascending: false });
        const ids = (list || []).map((p: any) => p.id);
        if (!ids.length) { if (!cancelled) setPosts([]); return; }
        const { data: logs } = await supabase
          .from('blog_review_logs')
          .select('post_id, created_at')
          .eq('action', 'approve')
          .in('post_id', ids);
        const approved = new Set((logs || []).map((l: any) => l.post_id));
        const filtered = (list || []).filter((p: any) => approved.has(p.id));
        if (!cancelled) setPosts(filtered as any);
      } catch (e) {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const publish = async (postId: string) => {
    try {
      const { error } = await supabase.rpc('review_approve_publish', { p_post_id: postId });
      if (error) throw error as any;
      toast.success('Post published');
      const { data: list } = await supabase
        .from('blog_posts')
        .select('id,title,description,created_at')
        .eq('status', 'in_review')
        .order('created_at', { ascending: false });
      const ids = (list || []).map((p: any) => p.id);
      if (!ids.length) { setPosts([]); return; }
      const { data: logs } = await supabase
        .from('blog_review_logs')
        .select('post_id')
        .eq('action', 'approve')
        .in('post_id', ids);
      const approved = new Set((logs || []).map((l: any) => l.post_id));
      setPosts(((list || []) as any).filter((p: any) => approved.has(p.id)));
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish');
    }
  };

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id} className="p-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{p.title}</div>
            <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary"><Link to={`/blogs/editor/${p.id}`}>Edit</Link></Button>
            <Button onClick={() => publish(p.id)}>Publish</Button>
          </div>
        </Card>
      ))}
      {!loading && posts.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No Guru‑approved items awaiting publish.</Card>
      )}
    </div>
  );
};

const AdminPublished: React.FC = () => {
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('blog_posts')
          .select('id,title,slug,created_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false });
        if (!cancelled) setPosts((data as any) || []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id} className="p-4 flex items-center justify-between">
          <div className="font-semibold">{p.title}</div>
          <Button asChild variant="outline"><a href={p.slug ? `/blogs/${p.slug}` : `/blogs`}>View</a></Button>
        </Card>
      ))}
      {!loading && posts.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No published posts.</Card>
      )}
    </div>
  );
};

const AdminRejected: React.FC = () => {
  const [items, setItems] = useState<Array<{ id: string; title: string; note?: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: posts } = await supabase
          .from('blog_posts')
          .select('id,title')
          .eq('status', 'archived')
          .order('updated_at', { ascending: false });
        const ids = (posts || []).map((p: any) => p.id);
        let notes: Record<string, string> = {};
        if (ids.length) {
          const { data: logs } = await supabase
            .from('blog_review_logs')
            .select('post_id, note, created_at')
            .in('post_id', ids)
            .eq('action', 'request_changes')
            .order('created_at', { ascending: false });
          (logs || []).forEach((l: any) => { if (!notes[l.post_id]) notes[l.post_id] = l.note || ''; });
        }
        const merged = ((posts || []) as any).map((p: any) => ({ id: p.id, title: p.title, note: notes[p.id] }));
        if (!cancelled) setItems(merged);
      } catch {
        if (!cancelled) setItems([]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="font-semibold">{p.title}</div>
          {p.note && <div className="text-sm text-muted-foreground mt-1">Note: {p.note}</div>}
        </Card>
      ))}
      {!loading && items.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No rejected posts.</Card>
      )}
    </div>
  );
};

const AdminArchived: React.FC = () => {
  return <AdminRejected />;
};

// -------- Exams Flow small panels (reuse existing endpoints)
interface LiteQuestion { id: string; created_at: string; question_text?: string; exam_type?: string | null; difficulty_level?: string | null; topic?: string | null; stem?: string }
interface GuruOption { id: string; label: string }

const DraftsPanel: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LiteQuestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [reviewerId, setReviewerId] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    try {
      const [gen, g] = await Promise.all([
        callFunction('/exams-admin-curate/generated', null, true),
        callFunction('/exams-admin-curate/gurus', null, true),
      ]);
      setRows(gen?.data || []);
      setGurus((g?.data || []) as GuruOption[]);
    } catch (e: any) {
      toast({ title: 'Load failed', description: e.message || 'Please try again', variant: 'destructive' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const allSelectedIds = Object.keys(selected).filter(id => selected[id]);
  const toggleOne = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    const flag = rows.length > 0 && allSelectedIds.length !== rows.length;
    rows.forEach(q => { next[q.id] = flag; });
    setSelected(next);
  };

  const assign = async () => {
    if (!reviewerId || allSelectedIds.length === 0) return;
    try {
      setLoading(true);
      await callFunction('/exams-admin-curate/assign', { question_ids: allSelectedIds, reviewer_id: reviewerId }, true);
      toast({ title: 'Assigned', description: `Assigned ${allSelectedIds.length} question(s).` });
      setSelected({});
      await load();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message || 'Please try again', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Generated</div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(q.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{q.question_text || q.stem}</TableCell>
                <TableCell className="text-xs">{q.exam_type || '-'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="secondary" asChild><a href={`/guru/exams/review?open=${q.id}`}>Open</a></Button>
                  <Button size="sm" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/save', { question_ids: [q.id] }, true); await load(); toast({ title: 'Saved as draft' }); } finally { setLoading(false);} }}>Save</Button>
                  <Button size="sm" variant="outline" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/archive', { question_ids: [q.id] }, true); await load(); toast({ title: 'Archived' }); } finally { setLoading(false);} }}>Archive</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No generated items</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const AssignedPanel: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<LiteQuestion & { reviewer?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [reassigning, setReassigning] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [assigned, g] = await Promise.all([
        callFunction('/exams-admin-curate/assigned', null, true),
        callFunction('/exams-admin-curate/gurus', null, true),
      ]);
      setRows((assigned?.data || []) as any);
      setGurus((g?.data || []) as GuruOption[]);
    } catch (e: any) {
      toast({ title: 'Load failed', description: e.message || 'Please try again', variant: 'destructive' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reassign = async (id: string) => {
    const reviewer_id = reassigning[id];
    if (!reviewer_id) return;
    try {
      setLoading(true);
      await callFunction('/exams-admin-curate/assign', { question_ids: [id], reviewer_id }, true);
      toast({ title: 'Reassigned', description: 'Question reassigned.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Reassign failed', description: e.message || 'Please try again', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Assigned</div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Guru</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(q => (
              <TableRow key={q.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(q.created_at!).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{q.question_text || q.stem}</TableCell>
                <TableCell className="text-xs">{(q as any).reviewer || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Select value={reassigning[q.id] || ''} onValueChange={(v) => setReassigning(s => ({ ...s, [q.id]: v }))}>
                      <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Select Guru" /></SelectTrigger>
                      <SelectContent>
                        {gurus.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => reassign(q.id)} disabled={!reassigning[q.id]}>Reassign</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No assigned items</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const ApprovedPanel: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<LiteQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const app = await callFunction('/exams-admin-curate/approved', null, true);
      setRows(app?.data || []);
    } catch (e: any) { toast({ title: 'Load failed', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const publish = async (id: string) => {
    try {
      await callFunction('/review-exams-api', { action: 'admin_publish', payload: { question_id: id } }, true);
      toast({ title: 'Published', description: 'Question is now live.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Approved</div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(q => (
              <TableRow key={q.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(q.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{q.question_text || q.stem}</TableCell>
                <TableCell className="text-xs">{q.exam_type || '-'}</TableCell>
                <TableCell className="text-xs">
                  <Button size="sm" onClick={() => publish(q.id)}>Publish</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No approved items</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const RejectedPanel: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<LiteQuestion[]>([]);
  const load = async () => {
    try {
      const rej = await callFunction('/exams-admin-curate/rejected', null, true);
      setRows(rej?.data || []);
    } catch (e: any) { toast({ title: 'Load failed', description: e.message, variant: 'destructive' }); }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="p-4">
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Exam</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(q => (
              <TableRow key={q.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(q.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{q.question_text || q.stem}</TableCell>
                <TableCell className="text-xs">{q.exam_type || '-'}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No rejected items</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const MarkedPanel: React.FC = () => {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Array<{ id: string; question_id: string; created_at: string; question_source: string; comment?: string | null; status: string; assigned_to?: string | null }>>([]);
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [assigning, setAssigning] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const { data, error } = await supabase.from('exam_question_flags').select('id, created_at, question_id, question_source, comment, status, assigned_to').order('created_at', { ascending: false });
      if (error) throw error;
      setFlags((data as any) || []);
      const g = await callFunction('/exams-admin-curate/gurus', null, true);
      setGurus((g?.data || []) as GuruOption[]);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    }
  };
  useEffect(() => { load(); }, []);

  const assign = async (flagId: string) => {
    const guruId = assigning[flagId];
    if (!guruId) return;
    try {
      await supabase.from('exam_question_flags').update({ assigned_to: guruId, status: 'assigned' }).eq('id', flagId);
      toast({ title: 'Assigned', description: 'Flag assigned to guru.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Assignment failed', description: e.message, variant: 'destructive' });
    }
  };
  const archive = async (flagId: string) => {
    try {
      await supabase.from('exam_question_flags').update({ status: 'archived' }).eq('id', flagId);
      toast({ title: 'Archived', description: 'Flag archived.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Archive failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Marked by Learners</div>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>

      {/* Mobile list */}
      <div className="md:hidden grid gap-3">
        {flags.map(f => (
          <Card key={f.id} className="p-4 space-y-3">
            <div className="text-sm text-muted-foreground">{new Date(f.created_at).toLocaleString()}</div>
            <div className="text-sm"><span className="font-medium">Source: </span>{f.question_source}</div>
            {f.comment && <div className="text-sm break-words"><span className="font-medium">Comment: </span>{f.comment}</div>}
            <div className="text-sm"><span className="font-medium">Status: </span>{f.status}</div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Select value={assigning[f.id] || f.assigned_to || ''} onValueChange={(v) => setAssigning(s => ({ ...s, [f.id]: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder={f.assigned_to ? 'Assigned' : 'Select guru'} /></SelectTrigger>
                <SelectContent>
                  {gurus.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => assign(f.id)} disabled={!assigning[f.id]}>Assign</Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  const reviewer_id = user?.id;
                  if (!reviewer_id || !f.question_id) return toast({ title: 'Sign in required', variant: 'destructive' });
                  await callFunction('/exams-admin-curate/assign', { question_ids: [f.question_id], reviewer_id }, true);
                  window.location.href = `/guru/exams/review?open=${f.question_id}`;
                } catch (e: any) {
                  toast({ title: 'Failed to open for review', description: e.message, variant: 'destructive' });
                }
              }}>Review</Button>
              <Button variant="outline" size="sm" onClick={() => archive(f.id)}>Archive</Button>
            </div>
          </Card>
        ))}
        {flags.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">No marked questions</Card>
        )}
      </div>

      {/* Desktop table */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assign</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map(f => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(f.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{f.question_source}</TableCell>
                <TableCell className="text-xs max-w-[360px] truncate" title={f.comment || ''}>{f.comment || '—'}</TableCell>
                <TableCell className="text-xs">{f.status}</TableCell>
                <TableCell>
                  <Select value={assigning[f.id] || f.assigned_to || ''} onValueChange={(v) => setAssigning(s => ({ ...s, [f.id]: v }))}>
                    <SelectTrigger className="w-48"><SelectValue placeholder={f.assigned_to ? 'Assigned' : 'Select guru'} /></SelectTrigger>
                    <SelectContent>
                      {gurus.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" onClick={() => assign(f.id)} disabled={!assigning[f.id]}>Assign</Button>
                  <Button size="sm" variant="secondary" onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      const reviewer_id = user?.id;
                      if (!reviewer_id || !f.question_id) return toast({ title: 'Sign in required', variant: 'destructive' });
                      await callFunction('/exams-admin-curate/assign', { question_ids: [f.question_id], reviewer_id }, true);
                      window.location.href = `/guru/exams/review?open=${f.question_id}`;
                    } catch (e: any) {
                      toast({ title: 'Failed to open for review', description: e.message, variant: 'destructive' });
                    }
                  }}>Review</Button>
                  <Button variant="outline" size="sm" onClick={() => archive(f.id)}>Archive</Button>
                </TableCell>
              </TableRow>
            ))}
            {flags.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No marked questions</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};


const GuruApprovalsTab: React.FC = () => {
  const [section, setSection] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const label = section === 'pending'
    ? 'Users requesting Guru status.'
    : section === 'approved'
    ? 'Requests you approved.'
    : 'Requests you rejected (with reason).';
  const btnCls = (active: boolean) => active ? 'px-3 py-1.5 text-sm font-medium bg-background rounded-md' : 'px-3 py-1.5 text-sm text-muted-foreground';
  return (
    <div className="p-0">
      <div className="p-4 text-sm text-muted-foreground">{label}</div>
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-1 rounded-md border bg-muted p-1">
          <button className={btnCls(section==='pending')} onClick={()=>setSection('pending')}>Pending</button>
          <button className={btnCls(section==='approved')} onClick={()=>setSection('approved')}>Approved</button>
          <button className={btnCls(section==='rejected')} onClick={()=>setSection('rejected')}>Rejected</button>
        </div>
      </div>
      <ApproveGurus embedded status={section} />
    </div>
  );
};

export default function DashboardAdmin() {
  useEffect(() => { document.title = "Admin Workspace | EMGurus"; }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-4 text-sm text-muted-foreground">Blog moderation and publishing at a glance.</div> },
        { id: "submitted", title: "Submitted", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts awaiting triage.</div><AdminSubmitted /></div> },
        { id: "assigned", title: "Assigned", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts assigned to reviewers.</div><AdminAssigned /></div> },
        { id: "reviewed", title: "Reviewed", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Guru‑approved items ready to publish.</div><AdminReviewed /></div> },
        { id: "published", title: "Published", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts that are live.</div><AdminPublished /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts where changes were requested.</div><AdminRejected /></div> },
        { id: "archived", title: "Archived", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Posts archived from review.</div><AdminArchived /></div> },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-4 text-sm text-muted-foreground">Question bank curation at a glance.</div> },
        {
          id: "questions",
          title: "Questions",
          render: (
            <div className="p-0">
              <div className="p-4 text-sm text-muted-foreground">Reviewed bank and filters.</div>
              <ReviewedQuestionBank embedded />
            </div>
          ),
        },
        {
          id: "sets",
          title: "Sets",
          render: (
            <div className="p-0">
              <div className="p-4 text-sm text-muted-foreground">Create and manage question sets.</div>
              <QuestionSetsAdmin />
            </div>
          ),
        },
        {
          id: "database",
          title: "Database",
          render: (
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">Manage exam metadata, SLOs, and taxonomy.</div>
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-3">Open the taxonomy manager to edit mappings.</div>
                <Button asChild><a href="/admin/taxonomy">Open Taxonomy Manager</a></Button>
              </Card>
            </div>
          ),
        },
        { id: "submit", title: "Submit", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Submit new questions for review.</div><SubmitQuestion /></div> },
        {
          id: "generate",
          title: "Generate",
          render: (
            <div className="p-0">
              <div className="p-4 text-sm text-muted-foreground">AI generation and assignment.</div>
              <ExamsAICuration />
            </div>
          ),
        },
        { id: "generated", title: "Generated", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Freshly generated drafts.</div><DraftsPanel /></div> },
        { id: "assigned", title: "Assigned", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Assigned to reviewers.</div><AssignedPanel /></div> },
        { id: "approved", title: "Approved", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Approved and ready to publish.</div><ApprovedPanel /></div> },
        { id: "rejected", title: "Rejected", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Rejected or needs changes.</div><RejectedPanel /></div> },
        { id: "marked", title: "Marked", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Learner‑flagged questions.</div><MarkedPanel /></div> },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Platform-level consultations health.</div><AdminConsultsOverview /></div> },
        { id: "bookings", title: "Bookings", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">All bookings with admin actions.</div><AdminConsultsBookings /></div> },
        { id: "gurus", title: "Gurus", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Manage gurus for consultations.</div><AdminConsultsGurus /></div> },
        { id: "policies", title: "Policies", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Guidelines & messaging shown to users and gurus.</div><AdminConsultsPolicies /></div> },
        { id: "notifications", title: "Notifications", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Templates and toggles.</div><AdminConsultsNotifications /></div> },
        { id: "settings", title: "Settings", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Platform rules.</div><AdminConsultsSettings /></div> },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { id: "overview", title: "Overview", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Forum moderation at a glance.</div></div> },
        { id: "moderation", title: "Moderation Queue", render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Threads and replies requiring action.</div><ForumsModeration /></div> },
      ],
    },
    {
      id: "analytics",
      title: "Analytics",
      icon: BarChart3,
      tabs: [ { id: "overview", title: "Overview", render: <AdminAnalyticsPanel /> } ],
    },
    { id: "users", title: "Users", icon: UsersRound, tabs: [ 
      { id: "manage", title: "Manage", render: <div className="p-4 text-sm text-muted-foreground">User management shortcuts coming soon.</div> },
      { id: "guru-approvals", title: "Guru Approvals", render: <GuruApprovalsTab /> },
    ] },
    { id: "settings", title: "Settings", icon: Settings, tabs: [ { id: "prefs", title: "Preferences", render: <div className="p-4 text-sm text-muted-foreground">Workspace settings.</div> } ] },
  ];

  return <WorkspaceLayout title="Admin Workspace" sections={sections} defaultSectionId="blogs" />;
}
