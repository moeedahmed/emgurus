import { useEffect } from "react";

const GuruQuestions = () => {
  useEffect(() => {
    document.title = "Create Questions | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Generate / Upload Questions</h1>
      <p className="text-muted-foreground mb-6">Question builder and importer coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default GuruQuestions;
