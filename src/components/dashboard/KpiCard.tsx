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
    <Card className="h-full rounded-lg shadow-sm p-4 bg-card border border-border/50 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-2 truncate">{title}</p>
          {isLoading ? (
            <div className="h-8 w-20 bg-muted rounded animate-pulse mb-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground mb-1 whitespace-nowrap">{value}</p>
          )}
          {(typeof deltaPct === 'number' || helpText) && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              {typeof deltaPct === 'number' && (
                <span className={deltaPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                </span>
              )}
              {helpText && <span className="truncate">{helpText}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-primary/10 ${iconColor || 'text-primary'} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default KpiCard;
