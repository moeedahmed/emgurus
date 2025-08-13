import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./OverviewTab";
import ExamsTab from "./ExamsTab";
import CurriculumTab from "./CurriculumTab";
import KnowledgeBaseTab from "./KnowledgeBaseTab";

const DatabaseManager = () => {
  return (
    <div className="p-4">
      <div className="text-sm text-muted-foreground mb-4">Manage exam metadata, SLOs, and taxonomy.</div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="exams">
          <ExamsTab />
        </TabsContent>

        <TabsContent value="curriculum">
          <CurriculumTab />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseManager;