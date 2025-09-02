import { isBlogsV2Enabled, isExamsV2Enabled } from "@/lib/flags";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * DevFlagBanner - Shows feature flag status in development only
 * Never renders in production
 */
export function DevFlagBanner() {
  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const blogsV2 = isBlogsV2Enabled();
  const examsV2 = isExamsV2Enabled();

  return (
    <Card className="fixed bottom-4 right-4 p-3 shadow-lg border-2 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 z-50">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-orange-800 dark:text-orange-200">Dev Flags:</span>
        <Badge variant={blogsV2 ? "default" : "secondary"} className="text-xs">
          BLOGS_V2: {blogsV2 ? "ON" : "OFF"}
        </Badge>
        <Badge variant={examsV2 ? "default" : "secondary"} className="text-xs">
          EXAMS_V2: {examsV2 ? "ON" : "OFF"}
        </Badge>
      </div>
    </Card>
  );
}