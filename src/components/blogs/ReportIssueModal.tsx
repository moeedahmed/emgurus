import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";

interface ReportIssueModalProps {
  postId: string;
  postTitle: string;
}

export default function ReportIssueModal({ postId, postTitle }: ReportIssueModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Please sign in to report issues", variant: "destructive" });
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      toast({ title: "Please provide at least 5 characters of feedback", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Use direct fetch to call the blogs-api edge function with the feedback endpoint
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(`https://cgtvvpzrzwyvsbavboxa.supabase.co/functions/v1/blogs-api/api/blogs/${postId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      toast({ title: "Feedback submitted successfully", description: "Thank you for helping us improve!" });
      setMessage("");
      setOpen(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="h-4 w-4 mr-2" />
          Report Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Blog Post:</p>
            <p className="text-sm text-muted-foreground">{postTitle}</p>
          </div>
          <div>
            <label className="text-sm font-medium">What's wrong with this post?</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue you found (medical inaccuracy, typo, broken link, etc.)"
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your feedback helps us maintain quality content. Be specific about the issue.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting || !message.trim()}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}