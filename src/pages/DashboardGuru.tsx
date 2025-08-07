import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
const DashboardGuru = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Guru Dashboard | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Guru Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Write or Edit Blogs</h2>
          <p className="text-muted-foreground mb-4">Share your expertise or update drafts.</p>
          <Button onClick={() => navigate('/editor')}>Open Editor</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Generate / Upload Questions</h2>
          <p className="text-muted-foreground mb-4">Create high-quality MCQs for learners.</p>
          <Button onClick={() => navigate('/guru/questions')}>Add Questions</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Review AI-Generated Questions</h2>
          <p className="text-muted-foreground mb-4">Approve, edit, and tag with your reviewer identity.</p>
          <Button onClick={() => navigate('/guru/reviews')}>Review Queue</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Define Availability & Pricing</h2>
          <p className="text-muted-foreground mb-4">Set your schedule for 1:1 bookings.</p>
          <Button onClick={() => navigate('/guru/availability')}>Configure</Button>
        </Card>
      </div>
    </main>
  );
};

export default DashboardGuru;
