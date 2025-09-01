import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { callFunction } from "@/lib/functionsUrl";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const GenerateExamQuestion: React.FC = () => {
  const navigate = useNavigate();
  const [examType, setExamType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!examType.trim()) {
      toast({ title: "Exam Type Required", description: "Please enter an exam type", variant: "destructive" });
      return;
    }
    if (!difficulty.trim()) {
      toast({ title: "Difficulty Required", description: "Please enter a difficulty level", variant: "destructive" });
      return;
    }
    if (!topic.trim()) {
      toast({ title: "Topic Required", description: "Please enter a topic", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const payload = { examType, difficulty, topic };
      const res = await callFunction("/generate-ai-question", payload, true);
      setResult(res);
      toast({ description: "AI question generated" });
    } catch (err: any) {
      const status = err?.status as number | undefined;
      if (status === 401) {
        toast({ description: "Please log in" });
      } else {
        toast({ description: err?.message || "Failed to generate question" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Generate AI Exam Question</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 w-full max-w-xl">
            <div>
              <Label htmlFor="examType">Exam Type *</Label>
              <Input 
                id="examType" 
                placeholder="e.g. mrcem_sba" 
                value={examType} 
                onChange={(e) => setExamType(e.target.value)}
                required
                className={!examType.trim() && examType !== "" ? "border-destructive" : ""}
              />
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty *</Label>
              <Input 
                id="difficulty" 
                placeholder="e.g. easy | medium | hard" 
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value)}
                required
                className={!difficulty.trim() && difficulty !== "" ? "border-destructive" : ""}
              />
            </div>
            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input 
                id="topic" 
                placeholder="e.g. Chest pain" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)}
                required
                className={!topic.trim() && topic !== "" ? "border-destructive" : ""}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Generating..." : "Generate"}
              </Button>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => navigate("/tools/my-exam-drafts")}
                className="w-full sm:w-auto"
              >
                View My Drafts
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="rounded-md border p-4">Requesting AI...</div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result?.question?.id ? (
              <div className="mb-3 text-sm">Saved ✓ (ID: {result.question.id})</div>
            ) : null}
            <pre className="text-sm overflow-auto bg-muted rounded p-3">{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default GenerateExamQuestion;
