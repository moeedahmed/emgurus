import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KPIData {
  exams: number;
  categories: number;
  topics: number;
  curriculumSlos: number;
  curriculumMaps: number;
  knowledgeSources: number;
}

interface RecentEdit {
  id: string;
  title: string;
  type: string;
  updated_at: string;
}

const OverviewTab = () => {
  const [kpis, setKpis] = useState<KPIData>({
    exams: 0,
    categories: 0,
    topics: 0,
    curriculumSlos: 0,
    curriculumMaps: 0,
    knowledgeSources: 0
  });
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      
      // Load KPI counts
      const [examsRes, categoriesRes, topicsRes, slosRes, mapsRes, kbRes] = await Promise.all([
        supabase.from('taxonomy_terms').select('id', { count: 'exact' }).eq('kind', 'exam'),
        supabase.from('taxonomy_terms').select('id', { count: 'exact' }).eq('kind', 'category'),
        supabase.from('taxonomy_terms').select('id', { count: 'exact' }).eq('kind', 'topic'),
        supabase.from('curriculum_slos').select('id', { count: 'exact' }),
        supabase.from('curriculum_map').select('id', { count: 'exact' }),
        supabase.from('knowledge_base').select('id', { count: 'exact' })
      ]);

      setKpis({
        exams: examsRes.count || 0,
        categories: categoriesRes.count || 0,
        topics: topicsRes.count || 0,
        curriculumSlos: slosRes.count || 0,
        curriculumMaps: mapsRes.count || 0,
        knowledgeSources: kbRes.count || 0
      });

      // Load recent edits from multiple sources
      const [termEdits, sloEdits, kbEdits] = await Promise.all([
        supabase.from('taxonomy_terms')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2),
        supabase.from('curriculum_slos')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2),
        supabase.from('knowledge_base')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
      ]);

      const allEdits: RecentEdit[] = [
        ...(termEdits.data || []).map((item: any) => ({ ...item, type: 'taxonomy' })),
        ...(sloEdits.data || []).map((item: any) => ({ ...item, type: 'curriculum' })),
        ...(kbEdits.data || []).map((item: any) => ({ ...item, type: 'knowledge' }))
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);

      setRecentEdits(allEdits);
    } catch (error: any) {
      toast({
        title: "Failed to load overview",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="space-y-4">Loading overview...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.exams}</div>
          <div className="text-sm text-muted-foreground">Exams</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.categories}</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.topics}</div>
          <div className="text-sm text-muted-foreground">Topics</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.curriculumSlos}</div>
          <div className="text-sm text-muted-foreground">Curriculum SLOs</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.curriculumMaps}</div>
          <div className="text-sm text-muted-foreground">Curriculum Maps</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{kpis.knowledgeSources}</div>
          <div className="text-sm text-muted-foreground">Knowledge Sources</div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Recently Edited</h3>
        {recentEdits.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recent edits</div>
        ) : (
          <div className="space-y-2">
            {recentEdits.map((edit) => (
              <div key={edit.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{edit.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{edit.type}</div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(edit.updated_at)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default OverviewTab;