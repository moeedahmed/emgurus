import React from "react";
import { BookOpen, BarChart3, UsersRound, Settings, Eye, ThumbsUp, MessageCircle, Share2, Flag, GraduationCap } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendCard from "@/components/dashboard/TrendCard";
import { useAdminMetrics } from "@/hooks/metrics/useAdminMetrics";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminAnalyticsPanel: React.FC = () => {
  const { kpis, submissionsSeries, workload, engagement, feedbackSummary, isLoading } = useAdminMetrics();
  return (
    <div className="sm:p-2 md:p-4 lg:p-6 grid gap-4 md:grid-cols-4">
      <KpiCard title="New Users (7d)" value={kpis.newUsers7d} isLoading={isLoading} icon={UsersRound} iconColor="text-blue-600" />
      <KpiCard title="Posts Submitted" value={kpis.postsSubmitted} isLoading={isLoading} icon={BookOpen} iconColor="text-purple-600" />
      <KpiCard title="Posts Assigned" value={kpis.postsAssigned} isLoading={isLoading} icon={Settings} iconColor="text-orange-600" />
      <KpiCard title="Posts Published" value={kpis.postsPublished} isLoading={isLoading} icon={BookOpen} iconColor="text-green-600" />
      <KpiCard title="Posts Rejected" value={kpis.postsRejected} isLoading={isLoading} icon={BookOpen} iconColor="text-red-600" />
      <KpiCard title="Avg Turnaround" value={`${kpis.avgTurnaroundDays} days`} isLoading={isLoading} icon={BarChart3} iconColor="text-gray-600" />
      <KpiCard title="Questions Pending" value={kpis.questionsPending} isLoading={isLoading} icon={GraduationCap} iconColor="text-yellow-600" />
      
      {/* Engagement KPIs */}
      <KpiCard title="Total Views" value={engagement.views} isLoading={isLoading} icon={Eye} iconColor="text-blue-600" />
      <KpiCard title="Total Likes" value={engagement.likes} isLoading={isLoading} icon={ThumbsUp} iconColor="text-green-600" />
      <KpiCard title="Total Comments" value={engagement.comments} isLoading={isLoading} icon={MessageCircle} iconColor="text-purple-600" />
      <KpiCard title="Total Shares" value={engagement.shares} isLoading={isLoading} icon={Share2} iconColor="text-orange-600" />
      <KpiCard title="Feedback Reports" value={`${feedbackSummary.unresolved}/${feedbackSummary.total}`} helpText="unresolved/total" isLoading={isLoading} icon={Flag} iconColor="text-gray-600" />
      <div className="md:col-span-4">
        <TrendCard title="Blog Submissions vs Publications" series={submissionsSeries} rangeLabel="Last 12 weeks" isLoading={isLoading} />
      </div>
      {workload.per_guru.length > 0 && (
        <div className="md:col-span-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Per-Guru Workload</h3>
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Guru</TableHead>
                    <TableHead>Active Assignments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workload.per_guru.map((guru) => (
                    <TableRow key={guru.guru_id}>
                      <TableCell>{guru.name}</TableCell>
                      <TableCell>{guru.active_assignments}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPanel;