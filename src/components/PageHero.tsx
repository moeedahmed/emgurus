import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface CTA {
  label: string;
  href: string;
  variant?: "default" | "outline" | "secondary";
}

interface PageHeroProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  eyebrow?: string;
  ctas?: CTA[];
  className?: string;
}

const PageHero = ({ title, subtitle, align = "left", eyebrow, ctas = [], className }: PageHeroProps) => {
  const isCenter = align === "center";

  return (
    <header
      className={cn(
        "relative overflow-hidden bg-gradient-to-b from-secondary to-background/30 border-b",
        "py-10 sm:py-14 lg:py-16 animate-fade-in",
        className
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {eyebrow && (
          <p className="mb-3 text-sm tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
        )}
        <h1
          className={cn(
            "heading-xl",
            isCenter ? "text-center" : "text-left"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "mt-3 max-w-3xl text-base sm:text-lg text-muted-foreground",
              isCenter ? "mx-auto text-center" : "text-left"
            )}
          >
            {subtitle}
          </p>
        )}
        {ctas.length > 0 && (
          <div
            className={cn(
              "mt-6 flex flex-wrap gap-3",
              isCenter ? "justify-center" : "justify-start"
            )}
          >
            {ctas.map((cta, idx) => (
              <Button key={idx} asChild variant={cta.variant || "default"}>
                <Link to={cta.href}>{cta.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
      <span className="pointer-events-none absolute -top-10 right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
    </header>
  );
};

export default PageHero;
