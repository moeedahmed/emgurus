import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DashboardAdmin = () => {
  useEffect(() => {
    document.title = "Admin Dashboard | EMGurus";
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Approve Gurus</h2>
          <p className="text-muted-foreground mb-4">Verify and onboard new mentors.</p>
          <Button variant="secondary" disabled>Open Approvals (soon)</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Moderate Blog Posts</h2>
          <p className="text-muted-foreground mb-4">Review drafts and publish when ready.</p>
          <Button variant="secondary" disabled>Moderate (soon)</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Assign AI Question Reviews</h2>
          <p className="text-muted-foreground mb-4">Distribute review tasks to Gurus.</p>
          <Button variant="secondary" disabled>Assign (soon)</Button>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Manage Categories & Tags</h2>
          <p className="text-muted-foreground mb-4">Maintain taxonomy across the platform.</p>
          <Button variant="secondary" disabled>Manage (soon)</Button>
        </Card>
      </div>
    </main>
  );
};

export default DashboardAdmin;
