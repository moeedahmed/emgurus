import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Option { key: string; text: string; explanation?: string }

export default function QuestionCard({
  stem,
  options,
  selectedKey,
  onSelect,
  showExplanation,
  explanation,
  source,
  correctKey,
  lockSelection,
  questionId,
}: {
  stem: string;
  options: Option[];
  selectedKey: string;
  onSelect: (k: string) => void;
  showExplanation?: boolean;
  explanation?: string;
  source?: string;
  correctKey?: string;
  lockSelection?: boolean;
  questionId?: string;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none py-4 break-words overflow-x-hidden">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stem}</ReactMarkdown>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border p-4 w-full">
        <RadioGroup key={questionId || 'q'} value={selectedKey} onValueChange={onSelect} className="w-full">
            {options.map((o) => {
              const isCorrect = !!showExplanation && !!correctKey && o.key === correctKey;
              const isWrongSel = !!showExplanation && !!correctKey && o.key === selectedKey && selectedKey !== correctKey;
              const rowKey = `${questionId || 'q'}-${o.key}`;
              return (
                <label
                  key={rowKey}
                  className={cn(
                    "flex items-start gap-3 py-2 rounded-md px-2 transition-colors w-full",
                    isCorrect && "bg-success/20 ring-1 ring-success/40",
                    isWrongSel && "bg-destructive/10 ring-1 ring-destructive/40"
                  )}
                >
                  <RadioGroupItem value={o.key} id={`opt-${questionId || 'q'}-${o.key}`} disabled={!!lockSelection} />
                  <div className="grid gap-1 min-w-0">
                    <div className="font-medium shrink-0">{o.key}.</div>
                    <div className="text-sm text-foreground/90 break-words overflow-x-hidden">
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
          <CardContent className="py-4 space-y-3">
            <div id="explanation-heading" tabIndex={-1} className="font-semibold mb-2 outline-none">Explanation</div>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-hidden">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation || "No explanation provided."}</ReactMarkdown>
            </div>
            {selectedKey && (
              <div>
                <div className="font-medium mb-1">Choice rationale</div>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-hidden">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {options.find(o => o.key === selectedKey)?.explanation ||
                      (correctKey ? options.find(o => o.key === correctKey)?.explanation || "" : "") ||
                      "No specific rationale provided for this option."}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {source && (
              <div className="text-sm text-muted-foreground mt-3">Source: {source}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
