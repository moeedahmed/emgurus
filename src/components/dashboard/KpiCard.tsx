import React from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  deltaPct?: number | null;
  helpText?: string;
  isLoading?: boolean;
  icon?: LucideIcon;
  iconColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, deltaPct, helpText, isLoading, icon: Icon, iconColor }) => {
  return (
    <Card className="rounded-2xl shadow-md p-3 sm:p-4 lg:p-6 bg-card border border-border/50 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 truncate">{title}</div>
          {isLoading ? (
            <div className="h-6 sm:h-8 w-16 sm:w-20 bg-muted rounded animate-pulse" />
          ) : (
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground break-all">{value}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {typeof deltaPct === 'number' ? (
              <span className={deltaPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
              </span>
            ) : null}
            {helpText && <span className="ml-1 sm:ml-2 truncate">{helpText}</span>}
          </div>
        </div>
        {Icon && (
          <div className={`p-2 sm:p-3 rounded-full bg-primary/10 ${iconColor || 'text-primary'} flex-shrink-0`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default KpiCard;
