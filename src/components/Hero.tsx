import React from "react";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-accent/10 py-8 lg:py-12 pt-16">
      <div className="page-container">
        <div className="text-center">
          {/* Hero title */}
          <div className="relative mb-6">
            <span className="pointer-events-none absolute -top-10 left-1/2 transform -translate-x-1/2 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <h1 className="heading-display">
              Master EM Exams.
              <span className="text-transparent bg-clip-text bg-gradient-hero block">
                Get Mentored.
              </span>
            </h1>
          </div>

          <p className="body-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
            Prepare, practice, and succeed with structured exam resources, expert guidance, 
            and comprehensive platform tools designed for medical learning excellence.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;