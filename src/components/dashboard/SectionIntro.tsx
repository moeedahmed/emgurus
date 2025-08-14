import React from "react";

interface SectionIntroProps {
  children: React.ReactNode;
}

const SectionIntro: React.FC<SectionIntroProps> = ({ children }) => {
  return (
    <div className="mb-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
};

export default SectionIntro;