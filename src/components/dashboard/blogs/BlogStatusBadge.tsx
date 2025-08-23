import { Badge } from "@/components/ui/badge";

type BlogStatus = 'draft' | 'in_review' | 'published' | 'rejected' | 'archived' | 'new' | 'resolved';

interface BlogStatusBadgeProps {
  status: BlogStatus;
}

const statusConfig = {
  draft: { label: "Draft", variant: "secondary" as const },
  in_review: { label: "Submitted", variant: "default" as const },
  published: { label: "Published", variant: "outline" as const },
  rejected: { label: "Rejected", variant: "destructive" as const },
  archived: { label: "Archived", variant: "secondary" as const },
  new: { label: "New", variant: "default" as const },
  resolved: { label: "Resolved", variant: "outline" as const },
};

export default function BlogStatusBadge({ status }: BlogStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}