import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
interface AIQuestion {
  id: string;
  question: string;
  options: string[]; // ['A. ...','B. ...','C. ...','D. ...']
  correct_answer: string; // 'A' | 'B' | 'C' | 'D'
  explanation?: string;
  source?: string;
}

interface CurriculumRow {
  id: string;
  slo_number: number;
  slo_title: string;
  key_capability_number: number;
  key_capability_title: string;
}

type Feedback = "none" | "too_easy" | "hallucinated" | "wrong" | "not_relevant";

const EXAMS = [
  { value: "MRCEM_PRIMARY", label: "MRCEM Primary" },
  { value: "MRCEM_SBA", label: "MRCEM Intermediate SBA" },
  { value: "FRCEM_SBA", label: "FRCEM SBA" },
];
const COUNTS = [10, 25, 50];

export default function AiPractice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const showInline = false; // Remove duplicate form

  if (showInline) {
    // Keep old form code for backwards compatibility, but it won't render
    return <div>Old inline form disabled</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-8 text-center">
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">AI Practice (Beta)</h3>
            <p className="text-muted-foreground">Start an AI-generated practice set.</p>
          </div>
          <Button size="lg" onClick={() => navigate('/exams/ai-practice')}>Start</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportChooser({ onChange }: { onChange: (v: Feedback) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Feedback>("none");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this question</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {([
            { k: "none", l: "No issue" },
            { k: "too_easy", l: "Too Easy" },
            { k: "not_relevant", l: "Irrelevant" },
            { k: "wrong", l: "Inaccurate / Wrong" },
            { k: "hallucinated", l: "Hallucinated" },
          ] as Array<{k: Feedback; l: string}>).map((o) => (
            <label key={o.k} className="flex items-center gap-3">
              <input
                type="radio"
                name="feedback"
                className="accent-[hsl(var(--primary))]"
                checked={value === o.k}
                onChange={() => setValue(o.k)}
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onChange(value); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
