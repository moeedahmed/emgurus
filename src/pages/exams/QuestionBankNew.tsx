import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QuestionRow {
  id: string;
  stem: string;
  exam: string;
  topic: string;
  difficulty: string;
  status: string;
}

export default function QuestionBankNew() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Question Bank | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { 
      meta = document.createElement('meta'); 
      meta.setAttribute('name', 'description'); 
      document.head.appendChild(meta); 
    }
    meta.setAttribute('content', 'Browse and manage exam questions in the question bank with advanced filtering and search capabilities.');
    
    loadDropdownData();
    loadQuestions();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [searchQuery, selectedExam, selectedTopic, selectedLevel]);

  useEffect(() => {
    // Filter topics based on selected exam
    if (selectedExam && selectedExam !== "all") {
      supabase
        .from('curriculum_map')
        .select('slo_title')
        .eq('exam_type', selectedExam as any)
        .then(({ data }) => {
          if (data) {
            const uniqueTopics = [...new Set(data.map(item => item.slo_title))];
            setFilteredTopics(uniqueTopics);
          }
        });
    } else {
      setFilteredTopics(topics);
    }
    
    // Reset topic when exam changes
    if (selectedTopic && selectedExam && selectedExam !== "all") {
      setSelectedTopic("all");
    }
  }, [selectedExam, topics]);

  const loadDropdownData = async () => {
    try {
      // Load exam types
      const examTypesData = ['MRCEM_PRIMARY', 'MRCEM_SBA', 'FRCEM_SBA'];
      setExamTypes(examTypesData);

      // Load all topics
      const { data: curriculumData } = await supabase
        .from('curriculum_map')
        .select('slo_title')
        .order('slo_title');

      if (curriculumData) {
        const uniqueTopics = [...new Set(curriculumData.map(item => item.slo_title))];
        setTopics(uniqueTopics);
        setFilteredTopics(uniqueTopics);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reviewed_exam_questions')
        .select('id, stem, exam, topic, difficulty, status')
        .eq('status', 'approved');

      // Apply filters
      if (selectedExam && selectedExam !== "all") {
        query = query.eq('exam', selectedExam);
      }
      if (selectedTopic && selectedTopic !== "all") {
        query = query.eq('topic', selectedTopic);
      }
      if (selectedLevel && selectedLevel !== "all") {
        query = query.eq('difficulty', selectedLevel);
      }
      if (searchQuery) {
        query = query.ilike('stem', `%${searchQuery}%`);
      }

      // Sort by exam type (default sort)
      query = query.order('exam').order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setQuestions(data || []);
    } catch (error: any) {
      toast({ title: "Error loading questions", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedExam("all");
    setSelectedTopic("all");
    setSelectedLevel("all");
  };

  const handleQuestionClick = (questionId: string) => {
    navigate(`/tools/submit-question/${questionId}`);
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <article className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Question Bank</h1>

        <Card className="p-6 space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="grid gap-2">
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger>
                  <SelectValue placeholder="All exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All exams</SelectItem>
                  {examTypes.map((exam) => (
                    <SelectItem key={exam} value={exam}>
                      {exam.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="All topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {filteredTopics.map((topic) => (
                    <SelectItem key={topic} value={topic}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          {/* Questions Table */}
          {loading ? (
            <div className="text-center py-8">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions found matching your criteria.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stem</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow
                      key={question.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleQuestionClick(question.id)}
                    >
                      <TableCell className="font-medium">
                        {truncateText(question.stem)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {question.exam?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{question.topic || "—"}</TableCell>
                      <TableCell>
                        {question.difficulty && (
                          <Badge 
                            variant={
                              question.difficulty === 'easy' ? 'default' : 
                              question.difficulty === 'medium' ? 'secondary' : 
                              'destructive'
                            }
                          >
                            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </article>
    </main>
  );
}