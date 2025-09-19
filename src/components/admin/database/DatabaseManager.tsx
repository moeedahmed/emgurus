import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./OverviewTab";
import ExamsTab from "./ExamsTab";
import CurriculumTab from "./CurriculumTab";
import KnowledgeBaseTab from "./KnowledgeBaseTab";

const DatabaseManager = () => {
  return (
    <div className="p-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>
        
        <TabsContent value="exams" className="mt-6">
          <ExamsTab />
        </TabsContent>
        
        <TabsContent value="curriculum" className="mt-6">
          <CurriculumTab />
        </TabsContent>
        
        <TabsContent value="knowledge" className="mt-6">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseManager;