import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function MarkForReviewButton({ currentQuestionId, source }: { currentQuestionId: string; source: 'ai' | 'reviewed' }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    try {
      setSaving(true);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { toast({ title: 'Sign in required', description: 'Please sign in to mark for review.' }); return; }
      const { error } = await supabase.from('exam_question_flags').insert({
        question_id: currentQuestionId,
        question_source: source,
        flagged_by: uid,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Marked for review', description: 'Thanks! Our team will review this question.' });
      setOpen(false);
      setComment("");
    } catch (e: any) {
      toast({ title: 'Failed to submit', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Mark for review</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this question for review</DialogTitle>
            <DialogDescription>Tell us what’s wrong or what should be improved. Our gurus will take a look.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Add an optional comment" value={comment} onChange={(e) => setComment(e.currentTarget.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
