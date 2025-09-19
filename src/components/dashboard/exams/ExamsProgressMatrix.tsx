import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { CURRICULA, EXAM_DISPLAY_NAMES, type ExamDisplayName } from "@/lib/examMapping";

interface ExamAttempt {
  id: string;
  user_id: string;
  started_at: string;
  breakdown?: any; // Json type from Supabase can be any valid JSON
  [key: string]: any; // Allow other fields from the database
}

interface TopicData {
  topic: string;
  attempts: number;
  acc: number;
}

export default function ExamsProgressMatrix() {
  const { user } = useAuth();
  const [exam, setExam] = useState<ExamDisplayName | "">("");
  const [range, setRange] = useState<'30'|'90'|'all'>("30");
  const [rows, setRows] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error: queryError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(500);

      if (queryError) {
        throw new Error(`Failed to load exam data: ${queryError.message}`);
      }

      // Validate and filter data safely
      const validData = (data || []).filter(attempt => {
        // Ensure we have valid date and user data
        return attempt && 
               attempt.started_at && 
               attempt.user_id &&
               (!since || attempt.started_at >= since);
      });

      setRows(validData);
    } catch (err) {
      console.error('Error fetching exam attempts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exam data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, range]);

  // Memoized topic calculations with safety checks
  const topics = useMemo(() => {
    if (!rows.length) return [];

    const agg: Record<string, { total: number, correct: number }> = {};
    
    rows.forEach(attempt => {
      if (!attempt.breakdown || typeof attempt.breakdown !== 'object') return;
      
      Object.entries(attempt.breakdown).forEach(([topic, data]) => {
        if (!topic || !data || typeof data !== 'object') return;
        
        const topicData = data as { total?: number; correct?: number };
        const total = Number(topicData.total || 0);
        const correct = Number(topicData.correct || 0);
        
        if (total > 0) {
          agg[topic] = agg[topic] || { total: 0, correct: 0 };
          agg[topic].total += total;
          agg[topic].correct += correct;
        }
      });
    });

    const topicArray: TopicData[] = Object.entries(agg)
      .map(([topic, data]) => ({
        topic,
        attempts: data.total,
        acc: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
      }))
      .sort((a, b) => a.topic.localeCompare(b.topic));

    return topicArray;
  }, [rows]);

  // Memoized coverage calculation with safety checks
  const areas = exam ? (CURRICULA[exam] || []) : [];
  const coveragePct = useMemo(() => {
    if (!exam || !areas.length || !topics.length) return 0;
    
    const topicSet = new Set(topics.map(t => t.topic));
    const coveredAreas = areas.filter(area => topicSet.has(area));
    
    return Math.round((coveredAreas.length / areas.length) * 100);
  }, [exam, topics, areas]);

  // Error state
  if (error) {
    return (
      <Card className="p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Unable to load progress data</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-32 mb-2"></div>
          <div className="h-4 bg-muted rounded w-48"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
        <div className="h-40 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="p-4 grid gap-4">
      <div>
        <h3 className="text-lg font-semibold">Progress</h3>
        <p className="text-sm text-muted-foreground">Accuracy by topic and curriculum coverage.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-sm font-medium mb-1">Exam</div>
          <Select value={exam || undefined} onValueChange={(v) => setExam(v as ExamName)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              {EXAM_DISPLAY_NAMES.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Range</div>
          <Select value={range} onValueChange={(v) => setRange(v as '30'|'90'|'all')}>
            <SelectTrigger><SelectValue placeholder="30 days" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <div className="text-sm text-muted-foreground">
            Curriculum coverage: {exam ? `${coveragePct}%` : '—'}
          </div>
        </div>
      </div>

      <TableCard
        title="Topic mastery"
        columns={[
          { key: 'topic', header: 'Topic' },
          { key: 'attempts', header: 'Attempts' },
          { key: 'acc', header: 'Accuracy %' },
        ]}
        rows={topics.map((t, i) => ({ id: i, ...t }))}
        emptyText={rows.length === 0 ? "No practice sessions found for this time period." : "No topic data available."}
      />

      {topics.length > 0 && (
        <div className="text-sm">
          <a 
            className="underline hover:no-underline" 
            href={`/exams?mode=practice${exam ? `&exam=${encodeURIComponent(exam)}` : ''}${topics[0] ? `&topic=${encodeURIComponent(topics[0].topic)}` : ''}`}
          >
            Practice {topics[0]?.topic || 'questions'} →
          </a>
        </div>
      )}
    </div>
  );
}
