import React from "react";
import { Card } from "@/components/ui/card";

interface Column<T> { key: keyof T; header: string; render?: (row: T) => React.ReactNode }

function TableCard<T extends { id?: string | number }>({ title, columns, rows, isLoading, emptyText, actions }: {
  title: string;
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyText?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="p-2 sm:p-4 lg:p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
        {actions}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="h-8 bg-muted rounded animate-pulse" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">{emptyText || "Nothing to show."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={String(c.key)} className="py-2 pr-2 sm:pr-3 font-medium whitespace-nowrap">{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={(r.id as any) ?? idx} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={String(c.key)} className="py-2 pr-2 sm:pr-3 text-xs sm:text-sm">{c.render ? c.render(r) : String(r[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default TableCard;
