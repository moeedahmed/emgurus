import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { CURRICULA, EXAM_DISPLAY_NAMES, type ExamDisplayName } from "@/lib/examMapping";

const COUNTS = [10, 25, 50];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

interface FloatingSettingsProps {
  currentExam: ExamDisplayName;
  currentCount: number;
  currentTopic: string;
  currentDifficulty: string;
  onUpdate: (settings: {
    exam: ExamDisplayName;
    count: number;
    topic: string;
    difficulty: string;
  }) => void;
}

export default function FloatingSettings({
  currentExam,
  currentCount,
  currentTopic,
  currentDifficulty,
  onUpdate
}: FloatingSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exam, setExam] = useState<ExamDisplayName>(currentExam);
  const [count, setCount] = useState(currentCount);
  const [topic, setTopic] = useState(currentTopic);
  const [difficulty, setDifficulty] = useState(currentDifficulty);

  const areas = exam ? ["All areas", ...CURRICULA[exam]] : ["All areas"];

  const handleApply = () => {
    onUpdate({ exam, count, topic, difficulty });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full w-16 h-16 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Settings className="w-6 h-6" />
          <span className="sr-only">Open Settings</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
      <Card className="w-80 shadow-lg">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Update Settings</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>×</Button>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Exam</Label>
              <Select value={exam} onValueChange={(v) => setExam(v as ExamDisplayName)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_DISPLAY_NAMES.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Questions</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTS.map(c => (
                    <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply to Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}