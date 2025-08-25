import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { CURRICULA, EXAMS, ExamName } from "@/lib/curricula";

const COUNTS = [10, 25, 50];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
];

interface Topic {
  id: string;
  title: string;
  exam_type: string;
}

interface FloatingSettingsProps {
  currentSettings: {
    exam: ExamName;
    count: number;
    topic_id: string;
    difficulty: string;
  };
  onSettingsChange: (settings: {
    exam: ExamName;
    count: number;
    topic_id: string;
    difficulty: string;
  }) => void;
  topics?: Topic[];
}

export default function FloatingSettings({
  currentSettings,
  onSettingsChange,
  topics = []
}: FloatingSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exam, setExam] = useState<ExamName>(currentSettings.exam);
  const [count, setCount] = useState(currentSettings.count);
  const [topicId, setTopicId] = useState(currentSettings.topic_id);
  const [difficulty, setDifficulty] = useState(currentSettings.difficulty);

  // Use topics from curriculum_map or fallback to CURRICULA
  const availableTopics = topics.length > 0 
    ? [{ id: "", title: "All areas", exam_type: "" }, ...topics]
    : [{ id: "", title: "All areas", exam_type: "" }, ...(exam ? CURRICULA[exam].map(topic => ({ id: topic, title: topic, exam_type: "" })) : [])];

  const handleApply = () => {
    onSettingsChange({ exam, count, topic_id: topicId, difficulty });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
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
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-80 shadow-lg">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Update Settings</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>×</Button>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Exam</Label>
              <Select value={exam} onValueChange={(v) => setExam(v as ExamName)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAMS.map(e => (
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
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTopics.map(topic => (
                    <SelectItem key={topic.id || topic.title} value={topic.id}>
                      {topic.title}
                    </SelectItem>
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