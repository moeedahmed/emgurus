import { useState } from "react";
import { Button } from "@/components/ui/button";
import OverviewTab from "./OverviewTab";
import ExamsTab from "./ExamsTab";
import CurriculumTab from "./CurriculumTab";
import KnowledgeBaseTab from "./KnowledgeBaseTab";

const DatabaseManager = () => {
  const [activeFilter, setActiveFilter] = useState<'overview' | 'exams' | 'curriculum' | 'knowledge'>('overview');

  const getComponent = () => {
    switch (activeFilter) {
      case 'overview': return <OverviewTab />;
      case 'exams': return <ExamsTab />;
      case 'curriculum': return <CurriculumTab />;
      case 'knowledge': return <KnowledgeBaseTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="p-0">
      
      <div className="flex gap-2 mb-6 px-6 pt-4 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'exams' as const, label: 'Exams' },
          { id: 'curriculum' as const, label: 'Curriculum' },
          { id: 'knowledge' as const, label: 'Knowledge Base' },
        ].map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {getComponent()}
    </div>
  );
};

export default DatabaseManager;