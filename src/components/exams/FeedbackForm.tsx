import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Standardized feedback tags used across all practice modes
const FEEDBACK_TAGS = ["Wrong answer", "Ambiguous", "Outdated", "Typo", "Too easy", "Too hard"] as const;

interface FeedbackFormProps {
  questionId: string;
  onSubmit: (type: 'good' | 'improvement', issues: string[], notes: string) => Promise<void>;
  submitted?: boolean;
}

export default function FeedbackForm({ questionId, onSubmit, submitted = false }: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<'good' | 'improvement' | null>(null);
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleFeedbackTypeChange = (type: 'good' | 'improvement') => {
    setFeedbackType(type);
    if (type === 'good') {
      setIssueTypes([]);
      setFeedbackNotes('');
    }
  };

  const handleToggleFeedbackTag = (tag: string) => {
    setIssueTypes(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!feedbackType) return;
    
    try {
      setSubmitting(true);
      await onSubmit(feedbackType, issueTypes, feedbackNotes);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-3 bg-success/10 border border-success/20 rounded-md text-success text-sm">
        ✓ Thank you for your feedback!
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-sm font-medium mb-3">Question Feedback</div>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={feedbackType === 'good' ? 'default' : 'outline'}
              onClick={() => handleFeedbackTypeChange('good')}
            >
              👍 Looks good
            </Button>
            <Button
              size="sm"
              variant={feedbackType === 'improvement' ? 'default' : 'outline'}
              onClick={() => handleFeedbackTypeChange('improvement')}
            >
              👎 Needs improvement
            </Button>
          </div>

          {feedbackType === 'improvement' && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              <div>
                <div className="text-sm font-medium mb-2">What's the issue? (select all that apply)</div>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_TAGS.map(tag => (
                    <Button
                      key={tag}
                      size="sm"
                      variant={issueTypes.includes(tag) ? 'default' : 'outline'}
                      onClick={() => handleToggleFeedbackTag(tag)}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor={`feedback-${questionId}`} className="text-sm font-medium">
                  Additional details (optional)
                </Label>
                <Textarea
                  id={`feedback-${questionId}`}
                  placeholder="Describe the issue in more detail..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          {feedbackType && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-32"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}