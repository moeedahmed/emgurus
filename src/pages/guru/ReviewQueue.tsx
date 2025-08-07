import { useEffect } from "react";

const GuruReviewQueue = () => {
  useEffect(() => {
    document.title = "Review Queue | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Review AI-Generated Questions</h1>
      <p className="text-muted-foreground mb-6">Approve, edit, and tag with your reviewer identity. Coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default GuruReviewQueue;
