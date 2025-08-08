import { Button } from "@/components/ui/button";

const ComingSoon = () => {
  return (
    <main>
      <section className="bg-gradient-to-br from-background via-secondary/20 to-accent/10 py-16 lg:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Coming Soon</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            This feature is under active development. In the meantime, explore our live sections below.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" asChild>
              <a href="/exams">Start Exams</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/consultations">Book Consultation</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/blogs">Explore Blogs</a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ComingSoon;
