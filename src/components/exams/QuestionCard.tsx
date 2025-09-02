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
        <CardContent className="prose prose-sm dark:prose-invert max-w-none py-4 w-full max-w-full break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stem}</ReactMarkdown>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border p-4 w-full max-w-full">
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
                   <div className="flex-1 min-w-0">
                     <div className="text-sm text-foreground/90 break-words max-w-full">
                      <span className="font-medium">{o.key}. </span>
                      <span className="inline"><ReactMarkdown remarkPlugins={[remarkGfm]}>{o.text}</ReactMarkdown></span>
                    </div>
                  </div>
                </label>
              );
            })}
        </RadioGroup>
      </div>

      {showExplanation && (
        <Card className="w-full max-w-full">
          <CardContent className="py-4 space-y-4 w-full max-w-full break-words">
            <div>
              <div id="explanation-heading" tabIndex={-1} className="font-semibold mb-2 outline-none">Main Explanation</div>
              <div className="prose prose-sm dark:prose-invert max-w-none break-words max-w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation || "No explanation provided."}</ReactMarkdown>
              </div>
            </div>
            
            {options.some(o => o.explanation) && (
              <div>
                <div className="font-semibold mb-2">Answer Options Rationale</div>
                <div className="space-y-3">
                  {options.filter(o => o.explanation).map(option => (
                    <div key={option.key} className={cn(
                      "border-l-4 pl-4 py-2",
                      option.key === correctKey ? "border-success bg-success/5" : "border-muted"
                    )}>
                      <div className="font-medium text-sm mb-1">
                        {option.key}. {option.text.length > 50 ? `${option.text.substring(0, 50)}...` : option.text}
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words max-w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{option.explanation}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {source && (
              <div className="text-sm text-muted-foreground border-t pt-3">Source: {source}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
