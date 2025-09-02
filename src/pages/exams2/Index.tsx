import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";

export default function Exams2Index() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Exam 2.0 
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </h1>
          <p className="text-muted-foreground">
            Next-generation exam platform with adaptive learning and detailed analytics.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Exam 2.0 features are currently in development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Adaptive question difficulty</p>
              <p>• Real-time performance tracking</p>
              <p>• Enhanced analytics and insights</p>
              <p>• Improved accessibility features</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}