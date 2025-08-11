import React from "react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string | number;
  deltaPct?: number | null;
  helpText?: string;
  isLoading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, deltaPct, helpText, isLoading }) => {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      {isLoading ? (
        <div className="h-7 w-24 bg-muted rounded mt-1 animate-pulse" />
      ) : (
        <div className="text-2xl font-semibold mt-1">{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">
        {typeof deltaPct === 'number' ? (
          <span className={deltaPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
          </span>
        ) : null}
        {helpText && <span className="ml-2">{helpText}</span>}
      </div>
    </Card>
  );
};

export default KpiCard;
