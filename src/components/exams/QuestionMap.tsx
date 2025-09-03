import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuestionMapProps {
  total: number;
  currentIndex: number;
  answered: Record<number, boolean> | number[] | undefined;
  onJump: (index: number) => void;
  dense?: boolean;
}

export default function QuestionMap({ total, currentIndex, answered, onJump, dense = false }: QuestionMapProps) {
  const isAnswered = (index: number) => {
    if (Array.isArray(answered)) {
      return answered.includes(index);
    }
    return answered?.[index] || false;
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: total }, (_, i) => (
        <Button
          key={i}
          variant={i === currentIndex ? "default" : isAnswered(i) ? "secondary" : "outline"}
          size={dense ? "sm" : "default"}
          className={cn(
            "aspect-square text-xs font-medium",
            dense && "h-8 w-8 p-0"
          )}
          onClick={() => onJump(i)}
          aria-label={`Go to question ${i + 1}${i === currentIndex ? ' (current)' : ''}${isAnswered(i) ? ' (answered)' : ''}`}
        >
          {i + 1}
        </Button>
      ))}
    </div>
  );
}