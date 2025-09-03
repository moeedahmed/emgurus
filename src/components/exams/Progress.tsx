import React from "react";

type Props = {
  current: number; // 1-based
  total: number;
  percent?: number; // optional override
  className?: string;
};

export default function Progress({ current, total, percent, className }: Props) {
  const pct = Math.min(100, Math.max(0, percent ?? (total > 0 ? (current / total) * 100 : 0)));
  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`Progress: question ${current} of ${total}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Question {current} of {total} {total > 0 ? `(${Math.round(pct)}%)` : ""}
      </div>
    </div>
  );
}