import React from "react";
import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { date: string; value: number; }

const TrendCard: React.FC<{ title: string; series: Point[]; rangeLabel?: string; isLoading?: boolean }>
= ({ title, series, rangeLabel, isLoading }) => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm text-muted-foreground">{rangeLabel}</div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      </div>
      {isLoading ? (
        <div className="h-32 bg-muted rounded animate-pulse" />
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide tickLine axisLine/>
              <YAxis hide tickLine axisLine/>
              <Tooltip formatter={(v: any) => String(v)} labelFormatter={(l) => l} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default TrendCard;
