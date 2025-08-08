import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import QuestionCard from "./QuestionCard";
import { Button } from "@/components/ui/button";

interface BankQuestion {
  id: string;
  question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_answer: string;
  explanation?: string | null;
  reviewed_by?: string | null;
  topic?: string | null;
  exam_type: string;
  difficulty_level: string;
  created_at: string;
}

export default function QuestionBank() {
  const [search, setSearch] = useState("");
  const [exam, setExam] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [sort, setSort] = useState<string>("recent");
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<Record<string, { name: string; avatar?: string }>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const remainingFree = useMemo(() => {
    const used = Number(localStorage.getItem("free_bank_used") || "0");
    return Math.max(0, 10 - used);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let q = supabase.from("questions").select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, reviewed_by, topic, exam_type, difficulty_level, created_at").eq("status","approved");
        if (exam) q = q.eq("exam_type", exam);
        if (difficulty) q = q.eq("difficulty_level", difficulty);
        if (topic) q = q.ilike("topic", `%${topic}%`);
        if (search) q = q.or(`question_text.ilike.%${search}%,option_a.ilike.%${search}%,option_b.ilike.%${search}%,option_c.ilike.%${search}%,option_d.ilike.%${search}%` as any);
        const { data, error } = await q.limit(50);
        if (error) throw error;
        const arr = (data || []) as BankQuestion[];
        setItems(arr);
        const ids = Array.from(new Set(arr.map(a => a.reviewed_by).filter(Boolean))) as string[];
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids);
          const map: Record<string, { name: string; avatar?: string }> = {};
          for (const p of (profs || []) as any[]) map[p.user_id] = { name: p.full_name || "Guru", avatar: p.avatar_url || undefined };
          setReviewers(map);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [exam, difficulty, topic, search]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "recent") arr.sort((a,b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return arr;
  }, [items, sort]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="py-4 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <Input placeholder="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={exam} onValueChange={setExam}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Exams</SelectItem>
              <SelectItem value="MRCEM Primary">MRCEM Primary</SelectItem>
              <SelectItem value="MRCEM Intermediate SBA">MRCEM Intermediate SBA</SelectItem>
              <SelectItem value="FRCEM Final">FRCEM Final</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="System / Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {remainingFree <= 0 && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="text-sm">You've reached the free Question Bank limit. Upgrade to continue.</div>
            <a href="/#pricing"><Button variant="hero">View Plans</Button></a>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sorted.map((q) => {
          const reviewer = q.reviewed_by ? reviewers[q.reviewed_by] : undefined;
          const isRevealed = revealed[q.id] || false;
          return (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-base">Reviewed Question</span>
                  <div className="flex items-center gap-2">
                    {reviewer && (
                      <span className="text-sm text-muted-foreground">By <a className="underline" href={`/profile/${q.reviewed_by}`}>{reviewer.name}</a></span>
                    )}
                    <Badge variant="secondary">{q.exam_type}</Badge>
                    {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <QuestionCard
                  stem={q.question_text}
                  options={[
                    { key: "A", text: q.option_a },
                    { key: "B", text: q.option_b },
                    { key: "C", text: q.option_c },
                    { key: "D", text: q.option_d },
                  ]}
                  selectedKey={""}
                  onSelect={() => {}}
                  showExplanation={isRevealed}
                  explanation={q.explanation || undefined}
                />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Difficulty: {q.difficulty_level || "unknown"}</div>
                  {!isRevealed ? (
                    <Button
                      onClick={() => {
                        const used = Number(localStorage.getItem("free_bank_used") || "0");
                        if (used >= 10) return; // blocked by banner
                        localStorage.setItem("free_bank_used", String(used + 1));
                        setRevealed((r) => ({ ...r, [q.id]: true }));
                      }}
                    >Reveal Explanation</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline">Like</Button>
                      <Button variant="outline">Dislike</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && sorted.length === 0 && (
        <div className="text-center text-muted-foreground">No questions found.</div>
      )}
    </div>
  );
}
