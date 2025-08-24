import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Upload, Link, Search } from "lucide-react";
import { callFunction } from "@/lib/functionsUrl";
import { getFieldErrors, showErrorToast, FieldError } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";

interface MultiReviewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (reviewerIds: string[], note: string) => void;
  availableReviewers: Array<{ id: string; name: string; avatar?: string }>;
  itemType: "blog" | "exam";
  itemTitle: string;
}

const MultiReviewerModal: React.FC<MultiReviewerModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  availableReviewers,
  itemType,
  itemTitle
}) => {
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedReviewers.length === 0) {
      alert("Please select at least one reviewer");
      return;
    }
    onAssign(selectedReviewers, note);
    setSelectedReviewers([]);
    setNote("");
    onClose();
  };

  const toggleReviewer = (reviewerId: string) => {
    setSelectedReviewers(prev => 
      prev.includes(reviewerId) 
        ? prev.filter(id => id !== reviewerId)
        : [...prev, reviewerId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Assign Reviewers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select reviewers for: {itemTitle}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Available Reviewers</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableReviewers.map(reviewer => (
                <div key={reviewer.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={reviewer.id}
                    checked={selectedReviewers.includes(reviewer.id)}
                    onCheckedChange={() => toggleReviewer(reviewer.id)}
                  />
                  <Label htmlFor={reviewer.id} className="flex-1 cursor-pointer">
                    {reviewer.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="assignment-note">Assignment Note (Optional)</Label>
            <Textarea
              id="assignment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any specific instructions for reviewers..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={selectedReviewers.length === 0}>
              Assign {selectedReviewers.length} Reviewer{selectedReviewers.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiReviewerModal;