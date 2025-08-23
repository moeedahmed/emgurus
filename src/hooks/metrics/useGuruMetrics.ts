import { useEffect, useState } from "react";
import { callFunction } from "@/lib/functionsUrl";

interface BlogMetrics {
  kpis: {
    submitted: number;
    assigned: number;
    published: number;
    rejected: number;
    turnaround_avg_days: number;
  };
  trends: {
    reviews_completed: Array<{ week: string; count: number }>;
  };
  engagement: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    feedback: number;
  };
  feedback_summary: {
    unresolved: number;
    resolved: number;
    total: number;
  };
}

export function useGuruMetrics() {
  const [isLoading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ 
    myAssignedCount: 0, 
    myReviewsCompleted: 0, 
    avgTurnaroundHrs: 0, 
    upcomingConsults: 0 
  });
  const [throughputSeries, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [queues, setQueues] = useState<{ questions: any[]; blogs: any[] }>({ questions: [], blogs: [] });
  const [engagement, setEngagement] = useState<BlogMetrics['engagement']>({ views: 0, likes: 0, comments: 0, shares: 0, feedback: 0 });
  const [feedbackSummary, setFeedbackSummary] = useState<BlogMetrics['feedback_summary']>({ unresolved: 0, resolved: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Get blog metrics from new endpoint - this is the primary source now
        const blogMetrics = await callFunction('/blogs-api/api/blogs/metrics', null, true, 'GET') as BlogMetrics;
        
        // Questions queue (edge function if available)
        let questionsCount = 0;
        try {
          const res = await callFunction('/exams-guru-review/queue', null, true);
          questionsCount = res?.data?.length || 0;
        } catch { questionsCount = 0; }

        // All blog assignment data comes from the metrics endpoint now
        const blogAssignedCount = blogMetrics.kpis.assigned || 0;
        const myAssignedCount = questionsCount + blogAssignedCount;
        
        // Calculate reviews completed from blog metrics
        const totalReviewsCompleted = blogMetrics.trends.reviews_completed?.reduce((sum, week) => sum + week.count, 0) || 0;

        if (!cancelled) {
          setKpis({ 
            myAssignedCount, 
            myReviewsCompleted: totalReviewsCompleted,
            avgTurnaroundHrs: Math.round(blogMetrics.kpis.turnaround_avg_days * 24) || 0,
            upcomingConsults: 0 
          });

          // Use blog review trends from the metrics endpoint
          const trendData = blogMetrics.trends.reviews_completed?.map(({ week, count }) => ({
            date: week,
            value: count
          })) || [];

          setSeries(trendData);
          setQueues({ questions: [], blogs: [] }); // Not needed anymore, kept for compatibility
          setEngagement(blogMetrics.engagement || { views: 0, likes: 0, comments: 0, shares: 0, feedback: 0 });
          setFeedbackSummary(blogMetrics.feedback_summary || { unresolved: 0, resolved: 0, total: 0 });
        }
      } catch (error) {
        console.error('Guru metrics error:', error);
        if (!cancelled) {
          setKpis({ myAssignedCount: 0, myReviewsCompleted: 0, avgTurnaroundHrs: 0, upcomingConsults: 0 });
          setSeries([]);
          setQueues({ questions: [], blogs: [] });
          setEngagement({ views: 0, likes: 0, comments: 0, shares: 0, feedback: 0 });
          setFeedbackSummary({ unresolved: 0, resolved: 0, total: 0 });
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { kpis, throughputSeries, queues, engagement, feedbackSummary, isLoading } as const;
}
