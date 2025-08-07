import { useEffect } from "react";

const ApproveGurus = () => {
  useEffect(() => {
    document.title = "Approve Gurus | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Approve Gurus</h1>
      <p className="text-muted-foreground mb-6">Verify and onboard new mentors. Coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default ApproveGurus;
