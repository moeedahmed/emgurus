import { useEffect } from "react";

const About = () => {
  useEffect(() => {
    document.title = "About EM Gurus | EMGurus";
  }, []);

  return (
    <main className="container mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">About EM Gurus</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          EM Gurus is dedicated to empowering Emergency Medicine professionals through AI-powered exams,
          expert mentorship, and high-quality educational content.
        </p>
      </header>

      <section className="grid gap-8">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <p>
            We bring together educators, clinicians, and learners to accelerate careers and improve patient care.
            Explore our blogs, practice questions, and connect with mentors worldwide.
          </p>
        </article>

        {/* Trustpilot widget */}
        <aside className="mt-6">
          <div
            className="trustpilot-widget"
            data-locale="en-GB"
            data-template-id="53aa8807dec7e10d38f59f32"
            data-businessunit-id=""
            data-style-height="150px"
            data-style-width="100%"
            data-theme="light"
          >
            <a href="https://uk.trustpilot.com/review/emgurus.com" rel="noopener noreferrer" target="_blank">Trustpilot</a>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default About;
