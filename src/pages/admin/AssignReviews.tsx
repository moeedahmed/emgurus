import { useEffect } from "react";

const AssignReviews = () => {
  useEffect(() => {
    document.title = "Assign Reviews | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Assign AI Question Reviews</h1>
      <p className="text-muted-foreground mb-6">Distribute review tasks to Gurus. Coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default AssignReviews;
