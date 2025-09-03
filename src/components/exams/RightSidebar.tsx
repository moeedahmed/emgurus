import React from "react";
import QuestionMap from "./QuestionMap";
import AIGuruPanel from "@/components/chat/AIGuruPanel";

type Props = {
  total: number;
  currentIndex: number;
  answered: Record<number, boolean> | number[] | undefined;
  onJump: (i: number) => void;
  mode: "practice" | "ai" | "exam";
  showGuru?: boolean;
  examId?: string;
  questionId?: string;
  kbId?: string;
};

export default function RightSidebar({
  total,
  currentIndex,
  answered,
  onJump,
  mode,
  showGuru = false,
  examId,
  questionId,
  kbId
}: Props) {
  return (
    <div className="sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto space-y-4 min-w-0">
      <div className="rounded-xl border bg-card p-4 min-w-0">
        <h3 className="font-medium mb-3">Questions</h3>
        <QuestionMap 
          total={total} 
          currentIndex={currentIndex} 
          answered={answered} 
          onJump={onJump} 
          dense 
        />
      </div>

      {showGuru && (
        <div className="rounded-xl border bg-card p-4 min-w-0">
          <h3 className="font-medium mb-3">AI Guru</h3>
          <AIGuruPanel 
            mode={mode} 
            examId={examId} 
            questionId={questionId} 
            kbId={kbId} 
          />
        </div>
      )}
    </div>
  );
}