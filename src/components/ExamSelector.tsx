import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, CheckCircle } from "lucide-react";

interface ExamSelectorProps {
  onStartQuiz: (config: QuizConfig) => void;
  type: 'realtime' | 'reviewed';
}

interface QuizConfig {
  examType: string;
  difficulty: string;
  topic: string;
  type: 'realtime' | 'reviewed';
}

const examTypes = ['FCPS', 'FRCEM', 'USMLE', 'PLAB', 'MRCP', 'Other'];
const difficulties = ['easy', 'medium', 'hard'];
const topics = [
  'Cardiology', 'Neurology', 'Gastroenterology', 'Endocrinology', 
  'Infectious Diseases', 'Pharmacology', 'Surgery', 'Pediatrics',
  'Obstetrics & Gynecology', 'Psychiatry'
];

const ExamSelector = ({ onStartQuiz, type }: ExamSelectorProps) => {
  const [examType, setExamType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [topic, setTopic] = useState('');

  const handleStart = () => {
    if (examType && difficulty && topic) {
      onStartQuiz({ examType, difficulty, topic, type });
    }
  };

  const isFormComplete = examType && difficulty && topic;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            {type === 'realtime' ? (
              <Sparkles className="w-6 h-6 text-blue-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            <h2 className="text-xl font-semibold">
              {type === 'realtime' ? 'AI Real-time Questions' : 'Guru-Reviewed Questions'}
            </h2>
          </div>
          {type === 'realtime' ? (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Not Guru-reviewed
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-600">
              Guru-approved
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Exam Type</label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger>
                <SelectValue placeholder="Select exam type" />
              </SelectTrigger>
              <SelectContent>
                {examTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Difficulty Level</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Topic</label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleStart}
          disabled={!isFormComplete}
          className="w-full"
          size="lg"
        >
          Start Quiz
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
};

export default ExamSelector;