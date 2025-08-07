import { useEffect } from "react";

const ModeratePosts = () => {
  useEffect(() => {
    document.title = "Moderate Blog Posts | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Moderate Blog Posts</h1>
      <p className="text-muted-foreground mb-6">Review drafts and publish when ready. Coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default ModeratePosts;
