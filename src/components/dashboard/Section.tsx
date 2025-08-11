import React from "react";

interface SectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ id, title, subtitle, actions, children }) => {
  return (
    <section id={id} className="mb-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
};

export default Section;
