import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const trim = (s: string, n = 120) => (s?.length > n ? s.slice(0, n - 1) + "…" : s);

const MyExamDrafts: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const fetchRows = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      toast({ description: err?.message || "Failed to load drafts" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const content = useMemo(() => rows, [rows]);

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">My AI Exam Drafts</h1>
        <Card>
          <CardHeader>
            <CardTitle>Authentication required</CardTitle>
          </CardHeader>
          <CardContent>
            Please log in to view your generated drafts.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">My AI Exam Drafts</h1>

      <div className="flex items-center gap-3 mb-4">
        <Button size="sm" onClick={fetchRows} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="p-3">Created</th>
              <th className="p-3">Question</th>
              <th className="p-3">Answer</th>
              <th className="p-3">Exam/Topic</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {content.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                <td className="p-3 max-w-[520px]">{trim(r.question_text || r.stem || "", 120)}</td>
                <td className="p-3">{r.correct_answer ?? r.correct_index ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{r.exam_type || r.exam || ""}{r.topic ? ` / ${r.topic}` : ""}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary">View JSON</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Row JSON</DialogTitle>
                        </DialogHeader>
                        <pre className="text-xs overflow-auto bg-muted rounded p-3 max-h-[60vh]">{JSON.stringify(r, null, 2)}</pre>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(JSON.stringify(r, null, 2));
                          toast({ description: "Copied to clipboard" });
                        } catch {
                          toast({ description: "Copy failed" });
                        }
                      }}
                    >
                      Copy JSON
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && content.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>No drafts yet. Generate one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default MyExamDrafts;
