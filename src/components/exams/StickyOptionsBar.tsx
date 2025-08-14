import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

interface StickyOptionsBarProps {
  currentExam: string;
  currentTopic: string;
  currentDifficulty: string;
  currentCount: number;
  questionIndex: number;
  totalQuestions: number;
  onUpdate: (exam: string, topic: string, difficulty: string, count: number) => void;
  onEditSelection: () => void;
}

export default function StickyOptionsBar({
  currentExam,
  currentTopic,
  currentDifficulty,
  currentCount,
  questionIndex,
  totalQuestions,
  onUpdate,
  onEditSelection
}: StickyOptionsBarProps) {
  const availableTopics = currentExam && (CURRICULA as any)[currentExam] 
    ? ["All areas", ...(CURRICULA as any)[currentExam]] 
    : ["All areas"];

  return (
    <div className="sticky top-[var(--site-header-height,56px)] z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-3 py-2 flex flex-wrap gap-2 items-center">
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {questionIndex + 1} of {totalQuestions}
          </Badge>
          <span className="text-sm text-muted-foreground">•</span>
          <Badge variant="secondary" className="text-xs">{currentExam}</Badge>
        </div>

        {/* Compact controls */}
        <div className="flex items-center gap-2 ml-auto">
          <Select value={currentTopic} onValueChange={(topic) => onUpdate(currentExam, topic, currentDifficulty, currentCount)}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTopics.map(topic => (
                <SelectItem key={topic} value={topic} className="text-xs">
                  {topic === "All areas" ? "All" : topic.substring(0, 15) + (topic.length > 15 ? "..." : "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currentDifficulty} onValueChange={(difficulty) => onUpdate(currentExam, currentTopic, difficulty, currentCount)}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map(d => (
                <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={onEditSelection} className="h-7 text-xs gap-1">
            <Settings className="h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}