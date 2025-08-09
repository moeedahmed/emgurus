import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Option { key: string; text: string }

export default function QuestionCard({
  stem,
  options,
  selectedKey,
  onSelect,
  showExplanation,
  explanation,
  source,
  correctKey,
}: {
  stem: string;
  options: Option[];
  selectedKey: string;
  onSelect: (k: string) => void;
  showExplanation?: boolean;
  explanation?: string;
  source?: string;
  correctKey?: string;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none py-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stem}</ReactMarkdown>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border p-4">
        <RadioGroup value={selectedKey} onValueChange={onSelect}>
            {options.map((o) => {
              const isCorrect = !!showExplanation && !!correctKey && o.key === correctKey;
              const isWrongSel = !!showExplanation && !!correctKey && o.key === selectedKey && selectedKey !== correctKey;
              return (
                <label
                  key={o.key}
                  className={cn(
                    "flex items-start gap-3 py-2 rounded-md px-2 transition-colors",
                    isCorrect && "bg-accent/40 ring-1 ring-primary/30",
                    isWrongSel && "opacity-70"
                  )}
                >
                  <RadioGroupItem value={o.key} id={`opt-${o.key}`} />
                  <div className="grid gap-1">
                    <div className="font-medium">{o.key}.</div>
                    <div className="text-sm text-foreground/90">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{o.text}</ReactMarkdown>
                    </div>
                  </div>
                </label>
              );
            })}
        </RadioGroup>
      </div>

      {showExplanation && (
        <Card>
          <CardContent className="py-4">
            <div className="font-semibold mb-2">Explanation</div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation || "No explanation provided."}</ReactMarkdown>
            </div>
            {source && (
              <div className="text-sm text-muted-foreground mt-3">Source: {source}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
