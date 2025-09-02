import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function Blogs2Index() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Blog 2.0 
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </h1>
          <p className="text-muted-foreground">
            Enhanced blogging experience with improved features and performance.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Blog 2.0 features are currently in development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Enhanced editor with rich formatting</p>
              <p>• Improved collaboration tools</p>
              <p>• Advanced analytics dashboard</p>
              <p>• Real-time commenting system</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}