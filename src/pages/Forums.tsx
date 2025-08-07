import { useEffect } from "react";

const Forums = () => {
  useEffect(() => {
    document.title = "Forums | EMGurus";
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Forums</h1>
        <p className="text-muted-foreground">Discuss by topic or exam. Coming soon with search, filters, and moderation.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["EM Exams", "Clinical Scenarios", "Study Tips", "Resources", "Announcements", "General"].map((name) => (
          <article key={name} className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-muted-foreground">Threads and replies will appear here.</p>
          </article>
        ))}
      </section>
    </main>
  );
};

export default Forums;
