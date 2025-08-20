import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';

interface DraftQuestion {
  id: string;
  stem: string;
  options: { text: string; explanation: string }[];
  correctIndex: number;
  explanation: string;
  reference?: string;
  assignedTo?: string;
  assignedGuruName?: string;
  createdAt: string;
}

interface Guru {
  id: string;
  name: string;
}

interface DraftEditModalProps {
  open: boolean;
  draft: DraftQuestion | null;
  gurus: Guru[];
  onSave: () => void;
  onCancel: () => void;
  formData: DraftQuestion | null;
  setFormData: React.Dispatch<React.SetStateAction<DraftQuestion | null>>;
}

export const DraftEditModal: React.FC<DraftEditModalProps> = ({
  open,
  draft,
  gurus,
  onSave,
  onCancel,
  formData,
  setFormData
}) => {
  if (!formData) return null;

  const updateOption = (index: number, field: 'text' | 'explanation', value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question Draft</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Question Stem */}
          <div>
            <Label htmlFor="stem">Question Stem</Label>
            <Textarea
              id="stem"
              value={formData.stem}
              onChange={(e) => setFormData({ ...formData, stem: e.target.value })}
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Options */}
          <div>
            <Label>Answer Options</Label>
            <div className="space-y-4 mt-2">
              {formData.options.map((option, index) => (
                <div key={index} className={`p-4 border rounded-lg ${
                  index === formData.correctIndex 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                    : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                    <Button
                      size="sm"
                      variant={index === formData.correctIndex ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, correctIndex: index })}
                    >
                      {index === formData.correctIndex ? "Correct" : "Mark Correct"}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="Option text"
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                    />
                    <Textarea
                      placeholder="Explanation for this option"
                      value={option.explanation}
                      onChange={(e) => updateOption(index, 'explanation', e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall Explanation */}
          <div>
            <Label htmlFor="explanation">Overall Explanation</Label>
            <Textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="mt-1"
              rows={3}
              placeholder="Overall explanation of the concept"
            />
          </div>

          {/* Reference */}
          <div>
            <Label htmlFor="reference">Reference (Optional)</Label>
            <Input
              id="reference"
              value={formData.reference || ''}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="mt-1"
              placeholder="Citation or reference"
            />
          </div>

          {/* Guru Assignment */}
          <div>
            <Label>Assign to Guru</Label>
            <Select
              value={formData.assignedTo || 'none'}
              onValueChange={(value) => {
                const guru = value === 'none' ? undefined : gurus.find(g => g.id === value);
                setFormData({ 
                  ...formData, 
                  assignedTo: value === 'none' ? undefined : value,
                  assignedGuruName: guru?.name
                });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select guru" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignment</SelectItem>
                {gurus.map(guru => (
                  <SelectItem key={guru.id} value={guru.id}>
                    {guru.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={onSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};