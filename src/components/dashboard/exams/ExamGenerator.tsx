import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ExamGenerator() {
  const { user, loading: userLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    difficulty: 'medium',
    count: '5',
    instructions: ''
  });
  const { toast } = useToast();

  // Guard against loading states
  if (userLoading) {
    return <div className="p-4">Loading generator…</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to use the exam generator.</div>;
  }

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for question generation.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Questions Generated",
        description: `${formData.count} questions created for ${formData.topic}`,
      });
      
      // Reset form
      setFormData({
        topic: '',
        difficulty: 'medium',
        count: '5',
        instructions: ''
      });
    } catch (error) {
      console.error('Error generating questions:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate questions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">AI Question Generator</h2>
        <p className="text-sm text-muted-foreground">Generate exam questions using AI assistance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
              placeholder="e.g., Cardiology, Emergency Medicine"
            />
          </div>

          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select 
              value={formData.difficulty} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="count">Number of Questions</Label>
            <Select 
              value={formData.count} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, count: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="instructions">Additional Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Any specific requirements or focus areas..."
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? "Generating..." : "Generate Questions"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}