import React, { useEffect, useState } from "react";
import WorkspaceLayout, { WorkspaceSection } from "@/components/dashboard/WorkspaceLayout";
import { BookOpen, MessageSquare, GraduationCap, BarChart3, UsersRound, Settings, Stethoscope, Brain } from "lucide-react";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import ForumsModerationQueue from "@/components/dashboard/forums/ForumsModerationQueue";
import TaxonomyManager from "@/components/dashboard/forums/TaxonomyManager";
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
import { Badge } from "@/components/ui/badge";
import QuestionGenerator from "@/pages/admin/QuestionGenerator";

import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import ExamsAICuration from "@/pages/admin/ExamsAICuration";
import SubmitQuestion from "@/pages/tools/SubmitQuestion";
import QuestionSetsAdmin from "@/pages/admin/QuestionSets";
import DatabaseManager from "@/components/admin/database/DatabaseManager";
import AdminConsultsOverview from "@/components/dashboard/consultations/AdminConsultsOverview";
import BlogsMarkedList from "@/components/dashboard/blogs/BlogsMarkedList";
import AdminConsultsBookings from "@/components/dashboard/consultations/AdminConsultsBookings";
import AdminConsultsGurus from "@/components/dashboard/consultations/AdminConsultsGurus";
import AdminConsultsPolicies from "@/components/dashboard/consultations/AdminConsultsPolicies";
import AdminGeneration from "@/components/admin/AdminGeneration";
import Generator from "@/pages/admin/Generator";
import AdminConsultsNotifications from "@/components/dashboard/consultations/AdminConsultsNotifications";
import AdminConsultsSettings from "@/components/dashboard/consultations/AdminConsultsSettings";
import ApproveGurus from "@/pages/admin/ApproveGurus";
import BlogTaxonomyManager from "@/components/blogs/BlogTaxonomyManager";

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

// -------- Blogs workflow components with chips
const BlogSubmissionQueue: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'submitted' | 'assigned' | 'approved' | 'rejected'>('submitted');

  const getComponent = () => {
    switch (activeFilter) {
      case 'submitted': return <AdminSubmitted />;
      case 'assigned': return <AdminAssigned />;
      case 'approved': return <AdminReviewed />;
      case 'rejected': return <AdminRejected />;
      default: return <AdminSubmitted />;
    }
  };

  return (
    <div className="p-4">
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'submitted' as const, label: 'Submitted' },
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Guru Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const BlogPublishedArchive: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'published' | 'archived'>('published');

  const getComponent = () => {
    switch (activeFilter) {
      case 'published': return <AdminPublished />;
      case 'archived': return <AdminArchived />;
      default: return <AdminPublished />;
    }
  };

  return (
    <div className="p-4">
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'published' as const, label: 'Published' },
          { id: 'archived' as const, label: 'Archived' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const MyBlogsAdmin: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'draft' | 'in_review'>('draft');

  return (
    <div className="p-4">
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'draft' as const, label: 'Draft' },
          { id: 'in_review' as const, label: 'Submitted' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <MyBlogStatusAdmin status={activeFilter} />
    </div>
  );
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
        callFunction('/exams-admin-curate/generated', null, true, 'GET'),
        callFunction('/exams-admin-curate/gurus', null, true, 'GET'),
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
        <div className="font-semibold">Drafts</div>
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
                  <Button size="sm" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/save', { question_ids: [q.id] }, true); await load(); toast({ title: 'Saved as draft' }); } finally { setLoading(false);} }} >Save</Button>
                  <Button size="sm" variant="outline" onClick={async()=>{ try{ setLoading(true); await callFunction('/exams-admin-curate/archive', { question_ids: [q.id] }, true); await load(); toast({ title: 'Archived' }); } finally { setLoading(false);} }} >Archive</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No drafts yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

// -------- Add missing original components
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

const MyBlogStatusAdmin: React.FC<{ status: 'draft' | 'in_review' }> = ({ status }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setRows([]); return; }
      const orderCol = status === 'in_review' ? 'submitted_at' : 'updated_at';
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,updated_at,submitted_at')
        .eq('author_id', uid)
        .eq('status', status)
        .order(orderCol as any, { ascending: false })
        .limit(50);
      if (!cancelled) setRows((data as any) || []);
    })();
    return () => { cancelled = true; };
  }, [status]);
  return (
    <div className="space-y-3">
      {rows.map((p) => (
        <Card key={p.id} className="p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold">{p.title}</div>
            <div className="text-xs text-muted-foreground">{new Date(p.submitted_at || p.updated_at).toLocaleString()}</div>
          </div>
          <Button asChild variant="outline"><a href={p.slug ? `/blogs/${p.slug}` : `/blogs`}>View</a></Button>
        </Card>
      ))}
      {rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">Nothing here yet.</Card>
      )}
    </div>
  );
};

// Exam panel components
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
        callFunction('/exams-admin-curate/assigned', null, true, 'GET'),
        callFunction('/exams-admin-curate/gurus', null, true, 'GET'),
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
                <TableCell className="text-xs">{q.reviewer || '-'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Select value={reassigning[q.id] || ''} onValueChange={(v) => setReassigning(p => ({ ...p, [q.id]: v }))}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Reassign" /></SelectTrigger>
                    <SelectContent>
                      {gurus.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => reassign(q.id)} disabled={!reassigning[q.id]}>Reassign</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No assigned questions</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const ApprovedPanel: React.FC = () => {
  return (
    <div className="p-4 space-y-3">
      <Card className="p-6 text-sm text-muted-foreground">Approved questions view coming soon.</Card>
    </div>
  );
};

const RejectedPanel: React.FC = () => {
  return (
    <div className="p-4 space-y-3">
      <Card className="p-6 text-sm text-muted-foreground">Rejected questions view coming soon.</Card>
    </div>
  );
};

// -------- Exams workflow components with chips
const ExamGeneration: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'generator' | 'generate' | 'drafts'>('generator');

  const getComponent = () => {
    switch (activeFilter) {
      case 'generator': return <Generator />;
      case 'generate': return <AdminGeneration />;
      case 'drafts': return <DraftsPanel />;
      default: return <Generator />;
    }
  };

  return (
    <div className="p-0">
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'generator' as const, label: 'Generator' },
          { id: 'generate' as const, label: 'Generate' },
          { id: 'drafts' as const, label: 'Drafts' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const ExamReviewAssignment: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'draft' | 'assigned' | 'approved' | 'rejected'>('draft');

  const getComponent = () => {
    switch (activeFilter) {
      case 'draft': return <DraftsPanel />;
      case 'assigned': return <AssignedPanel />;
      case 'approved': return <ApprovedPanel />;
      case 'rejected': return <RejectedPanel />;
      default: return <DraftsPanel />;
    }
  };

  return (
    <div className="p-0">
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'draft' as const, label: 'Draft' },
          { id: 'assigned' as const, label: 'Assigned' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const ExamMarkedQuality: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'open' | 'resolved'>('open');

  return (
    <div className="p-0">
      <div className="p-4 text-sm text-muted-foreground">
        Address user feedback and quality flags.
      </div>
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'open' as const, label: 'Open' },
          { id: 'resolved' as const, label: 'Resolved' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <MarkedPanel />
    </div>
  );
};

const ExamBankSets: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'questions' | 'sets' | 'database'>('questions');

  const getComponent = () => {
    switch (activeFilter) {
      case 'questions': return <ReviewedQuestionBank embedded />;
      case 'sets': return <QuestionSetsAdmin />;
      case 'database': return <DatabaseManager />;
      default: return <ReviewedQuestionBank embedded />;
    }
  };

  return (
    <div className="p-0">
      <div className="p-4 text-sm text-muted-foreground">
        Browse approved questions, manage sets, and configure exam database.
      </div>
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'questions' as const, label: 'Questions' },
          { id: 'sets' as const, label: 'Sets' },
          { id: 'database' as const, label: 'Database' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const MyQuestionsAdmin: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'draft' | 'submitted' | 'approved' | 'rejected'>('draft');

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Your authored questions.
      </div>
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'draft' as const, label: 'Draft' },
          { id: 'submitted' as const, label: 'Submitted' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <Card className="p-6 text-sm text-muted-foreground">Your authored questions view coming soon.</Card>
    </div>
  );
};

// --- Section Overview Panels
const BlogsOverviewPanel: React.FC = () => {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ submitted: 0, assigned: 0, published7d: 0, rejected7d: 0 });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const [ { count: submitted }, { count: assigned }, { count: published7d }, { count: rejected7d } ] = await Promise.all([
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status','in_review'),
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status','in_review').not('reviewer_id','is', null),
          supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status','published').gte('published_at', from),
          supabase.from('blog_review_logs').select('post_id', { count: 'exact', head: true }).eq('action','request_changes').gte('created_at', from),
        ]);
        if (!cancelled) setKpis({ submitted: submitted ?? 0, assigned: assigned ?? 0, published7d: published7d ?? 0, rejected7d: rejected7d ?? 0 });
      } catch {
        if (!cancelled) setKpis({ submitted: 0, assigned: 0, published7d: 0, rejected7d: 0 });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="Submitted" value={kpis.submitted} isLoading={isLoading} />
      <KpiCard title="Assigned" value={kpis.assigned} isLoading={isLoading} />
      <KpiCard title="Published (7d)" value={kpis.published7d} isLoading={isLoading} />
      <KpiCard title="Rejected (7d)" value={kpis.rejected7d} isLoading={isLoading} />
    </div>
  );
};

const ExamsOverviewPanel: React.FC = () => {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ drafts: 0, inReview: 0, flagsOpen: 0, published7d: 0 });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const [ d1, d2, d3, d4 ] = await Promise.all([
          supabase.from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','draft'),
          supabase.from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','under_review'),
          supabase.from('exam_question_flags').select('id', { count: 'exact', head: true }).eq('status','open'),
          supabase.from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','published').gte('updated_at', from),
        ]);
        if (!cancelled) setKpis({ drafts: d1.count ?? 0, inReview: d2.count ?? 0, flagsOpen: d3.count ?? 0, published7d: d4.count ?? 0 });
      } catch {
        if (!cancelled) setKpis({ drafts: 0, inReview: 0, flagsOpen: 0, published7d: 0 });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="Drafts" value={kpis.drafts} isLoading={isLoading} />
      <KpiCard title="In Review" value={kpis.inReview} isLoading={isLoading} />
      <KpiCard title="Flags Open" value={kpis.flagsOpen} isLoading={isLoading} />
      <KpiCard title="Published (7d)" value={kpis.published7d} isLoading={isLoading} />
    </div>
  );
};

const ForumsOverviewPanel: React.FC = () => {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ openFlags: 0, assigned: 0, closed7d: 0, totalCategories: 0 });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const [ { count: openFlags }, { count: assigned }, { count: closed7d }, { count: cats } ] = await Promise.all([
          supabase.from('forum_flags').select('id', { count: 'exact', head: true }).eq('status','open'),
          supabase.from('forum_flags').select('id', { count: 'exact', head: true }).eq('status','open').not('assigned_to','is', null),
          supabase.from('forum_flags').select('id', { count: 'exact', head: true }).neq('status','open').gte('updated_at', from),
          supabase.from('forum_categories').select('id', { count: 'exact', head: true }),
        ]);
        if (!cancelled) setKpis({ openFlags: openFlags ?? 0, assigned: assigned ?? 0, closed7d: closed7d ?? 0, totalCategories: cats ?? 0 });
      } catch {
        if (!cancelled) setKpis({ openFlags: 0, assigned: 0, closed7d: 0, totalCategories: 0 });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="p-4 grid gap-4 md:grid-cols-4">
      <KpiCard title="Open Flags" value={kpis.openFlags} isLoading={isLoading} />
      <KpiCard title="Assigned" value={kpis.assigned} isLoading={isLoading} />
      <KpiCard title="Closed (7d)" value={kpis.closed7d} isLoading={isLoading} />
      <KpiCard title="Categories" value={kpis.totalCategories} isLoading={isLoading} />
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
      const g = await callFunction('/exams-admin-curate/gurus', null, true, 'GET');
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

// Consultations workflow components
const ConsultMarketplaceControls: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'policies' | 'notifications' | 'settings'>('policies');

  const getComponent = () => {
    switch (activeFilter) {
      case 'policies': return <AdminConsultsPolicies />;
      case 'notifications': return <AdminConsultsNotifications />;
      case 'settings': return <AdminConsultsSettings />;
      default: return <AdminConsultsPolicies />;
    }
  };

  return (
    <div className="p-0">
      <div className="p-4 text-sm text-muted-foreground">
        Set marketplace rules and defaults.
      </div>
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'policies' as const, label: 'Policies' },
          { id: 'notifications' as const, label: 'Notifications' },
          { id: 'settings' as const, label: 'Settings' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

const ConsultBookingsOversight: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  return (
    <div className="p-0">
      <div className="p-4 text-sm text-muted-foreground">
        Monitor consultations across the platform.
      </div>
      
      <div className="flex gap-2 mb-4 px-4">
        {[
          { id: 'upcoming' as const, label: 'Upcoming' },
          { id: 'past' as const, label: 'Past' },
          { id: 'cancelled' as const, label: 'Cancelled' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <AdminConsultsBookings statusFilter={activeFilter} />
    </div>
  );
};

const GuruApprovalsTab: React.FC = () => {
  const [section, setSection] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [counts, setCounts] = useState<{ pending: number; approved7d: number; rejected7d: number }>({ pending: 0, approved7d: 0, rejected7d: 0 });

  useEffect(() => {
    (async () => {
      const now = new Date();
      const ago7 = new Date(now.getTime() - 7*24*60*60*1000).toISOString();
      const [{ count: pCount }, { count: a7 }, { count: r7 }] = await Promise.all([
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','pending'),
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','approved').gte('updated_at', ago7),
        supabase.from('guru_applications').select('id', { count: 'exact', head: true }).eq('status','rejected').gte('updated_at', ago7),
      ]);
      setCounts({ pending: pCount ?? 0, approved7d: a7 ?? 0, rejected7d: r7 ?? 0 });
    })();
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Review and approve guru applications.
      </div>
      
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <KpiCard title="Pending" value={counts.pending} isLoading={false} />
        <KpiCard title="Approved (7d)" value={counts.approved7d} isLoading={false} />
        <KpiCard title="Rejected (7d)" value={counts.rejected7d} isLoading={false} />
      </div>
      
      <div className="flex gap-2 mb-4">
        {[
          { id: 'pending' as const, label: 'Pending' },
          { id: 'approved' as const, label: 'Approved' },
          { id: 'rejected' as const, label: 'Rejected' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={section === chip.id ? "default" : "outline"}
            onClick={() => setSection(chip.id)}
            aria-pressed={section === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>
      
      <ApproveGurus embedded status={section} />
    </div>
  );
};

export default function DashboardAdmin() {
  useEffect(() => { document.title = "Admin Workspace | EM Gurus"; }, []);

  const [examKpis, setExamKpis] = useState({ approved: 0, under_review: 0, draft: 0, rejected: 0, flaggedOpen: 0 });
  useEffect(() => {
    (async () => {
      try {
        const [{ count: appr }, { count: und }, { count: dr }, { count: rej }, { count: flg }] = await Promise.all([
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','approved'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','under_review'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','draft'),
          (supabase as any).from('review_exam_questions').select('id', { count: 'exact', head: true }).eq('status','rejected'),
          (supabase as any).from('exam_question_flags').select('id', { count: 'exact', head: true }).eq('status','open'),
        ]);
        setExamKpis({ approved: appr ?? 0, under_review: und ?? 0, draft: dr ?? 0, rejected: rej ?? 0, flaggedOpen: flg ?? 0 });
      } catch {
        setExamKpis({ approved: 0, under_review: 0, draft: 0, rejected: 0, flaggedOpen: 0 });
      }
    })();
  }, []);

  const sections: WorkspaceSection[] = [
    {
      id: "blogs",
      title: "Blogs",
      icon: BookOpen,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Blog moderation and publishing at a glance.</div><BlogsOverviewPanel /></div> 
        },
        { 
          id: "submission-queue", 
          title: "Submission Queue", 
          description: "Triage incoming posts and assign to reviewers.", 
          render: <BlogSubmissionQueue /> 
        },
        { 
          id: "published-archive", 
          title: "Published & Archive", 
          description: "Manage published posts and archive.", 
          render: <BlogPublishedArchive /> 
        },
        { 
          id: "taxonomy", 
          title: "Taxonomy", 
          description: "Manage blog categories and subcategories.", 
          render: <BlogTaxonomyManager /> 
        },
        { 
          id: "my-blogs", 
          title: "My Blogs", 
          description: "Your authored posts.", 
          render: <MyBlogsAdmin /> 
        },
        { 
          id: "marked", 
          title: "Marked", 
          description: "Unresolved blog feedback from users.", 
          render: <div className="p-0"><BlogsMarkedList /></div> 
        },
      ],
    },
    {
      id: "exams",
      title: "Exams",
      icon: GraduationCap,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-4 grid gap-4 md:grid-cols-5"><KpiCard title="Generated (7d)" value="0" isLoading={false} /><KpiCard title="In Review" value={examKpis.under_review} isLoading={false} /><KpiCard title="Published" value={examKpis.approved} isLoading={false} /><KpiCard title="Quality Flags Open" value={examKpis.flaggedOpen} isLoading={false} /><div className="text-sm text-muted-foreground">Coverage chart coming soon</div></div> 
        },
        { 
          id: "generation", 
          title: "Generation", 
          description: "Generate AI questions by exam/topic/difficulty.", 
          render: <ExamGeneration /> 
        },
        { 
          id: "review-assignment", 
          title: "Review & Assignment", 
          description: "Assign questions to gurus and track decisions.", 
          render: <ExamReviewAssignment /> 
        },
        { 
          id: "marked-quality", 
          title: "Marked & Quality", 
          description: "Address user feedback and quality flags.", 
          render: <ExamMarkedQuality /> 
        },
        { 
          id: "bank-sets", 
          title: "Bank & Sets", 
          description: "Browse approved questions and manage sets.", 
          render: <ExamBankSets /> 
        },
        { 
          id: "my-questions", 
          title: "My Questions", 
          description: "Your authored questions.", 
          render: <MyQuestionsAdmin /> 
        },
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      icon: Stethoscope,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Platform-level consultations health.</div><AdminConsultsOverview /></div> 
        },
        { 
          id: "guru-approvals", 
          title: "Guru Approvals", 
          description: "Review and approve guru applications.", 
          render: <GuruApprovalsTab /> 
        },
        { 
          id: "marketplace-controls", 
          title: "Marketplace Controls", 
          description: "Set marketplace rules and defaults.", 
          render: <ConsultMarketplaceControls /> 
        },
        { 
          id: "bookings-oversight", 
          title: "Bookings Oversight", 
          description: "Monitor consultations across the platform.", 
          render: <ConsultBookingsOversight /> 
        },
      ],
    },
    {
      id: "forums",
      title: "Forums",
      icon: MessageSquare,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          description: "Forum health and activity.",
          render: <div className="p-0"><div className="p-4 text-sm text-muted-foreground">Forum health and activity.</div><ForumsOverviewPanel /></div> 
        },
        { 
          id: "moderation", 
          title: "Moderation Queue", 
          description: "Organization-wide flag handling.", 
          render: <div className="p-0"><ForumsModerationQueue isAdmin={true} /></div> 
        },
        { 
          id: "taxonomy", 
          title: "Taxonomy & Tags", 
          description: "Manage categories and topics used across forums.", 
          render: <div className="p-0"><TaxonomyManager /></div> 
        },
      ],
    },
    {
      id: "users",
      title: "Users",
      icon: UsersRound,
      tabs: [
        { 
          id: "overview", 
          title: "Overview", 
          render: <div className="p-4 grid gap-4 md:grid-cols-3"><KpiCard title="Total Users" value="0" isLoading={false} /><KpiCard title="Active (7d)" value="0" isLoading={false} /><KpiCard title="New Today" value="0" isLoading={false} /></div> 
        },
        { 
          id: "guru-approvals", 
          title: "Guru Approvals", 
          description: "Review and approve guru applications.", 
          render: <GuruApprovalsTab /> 
        },
        { 
          id: "directory", 
          title: "Directory & Roles", 
          description: "Manage user roles and permissions.", 
          render: <div className="p-4"><Card className="p-6 text-sm text-muted-foreground">User directory coming soon.</Card></div> 
        },
      ],
    },
    {
      id: "settings",
      title: "Settings",
      icon: Settings,
      tabs: [
        { 
          id: "notifications", 
          title: "Notifications", 
          description: "Per-role defaults and email settings.", 
          render: <div className="p-4"><Card className="p-6 text-sm text-muted-foreground">Notification settings coming soon.</Card></div> 
        },
        { 
          id: "features", 
          title: "Feature Flags / Branding", 
          description: "Admin toggles and customization.", 
          render: <div className="p-4"><Card className="p-6 text-sm text-muted-foreground">Feature flags coming soon.</Card></div> 
        },
      ],
    },
    {
      id: "experimental",
      title: "🧪 Experimental",
      icon: Brain,
      tabs: [
        { 
          id: "question-generator", 
          title: "Question Generator 🧠", 
          description: "Modern AI question generation interface (Beta).", 
          render: <QuestionGenerator />
        },
        { 
          id: "blog-generator", 
          title: "Blog Generator 🤖", 
          description: "AI-powered blog generation and assignment tool (Experimental).", 
          render: <div className="p-4">
            <div className="mb-4">
              <Button asChild>
                <a href="/tools/generate-blog-draft">Launch Blog Generator</a>
              </Button>
            </div>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Generate AI-written blog drafts and assign them to Gurus for review. 
                This experimental tool helps admins create high-quality content efficiently.
              </p>
            </Card>
          </div>
        },
      ],
    },
  ];

  return <WorkspaceLayout title="Admin Workspace" sections={sections} defaultSectionId="blogs" />;
}
