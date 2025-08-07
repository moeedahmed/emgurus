import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const DashboardUser = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Learner Dashboard | EMGurus";
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Learner Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Start a Quiz</h2>
          <p className="text-muted-foreground mb-4">Practice questions tailored to your exam and level.</p>
          <Button onClick={() => navigate('/quiz')}>Go to Quiz</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Explore Blogs</h2>
          <p className="text-muted-foreground mb-4">Read expert articles and learning resources.</p>
          <Button onClick={() => navigate('/blog')}>View Blog</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Book Consultation</h2>
          <p className="text-muted-foreground mb-4">Schedule 1:1 mentoring with verified Gurus.</p>
          <Button variant="secondary" disabled>Coming soon</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Track Progress</h2>
          <p className="text-muted-foreground mb-4">Review your quiz attempts and strengths.</p>
          <Button variant="secondary" disabled>Coming soon</Button>
        </Card>
      </div>
    </main>
  );
};

export default DashboardUser;
