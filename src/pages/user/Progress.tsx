import { useEffect } from "react";

const UserProgress = () => {
  useEffect(() => {
    document.title = "Your Progress | EMGurus";
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Track Progress</h1>
      <p className="text-muted-foreground mb-6">Quiz attempts, strengths, and CPD summary will appear here.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default UserProgress;
