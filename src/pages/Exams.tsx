import { useEffect } from "react";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import AiPractice from "@/components/exams/AiPractice";
import QuestionBank from "@/components/exams/QuestionBank";
const setSEO = () => {
  document.title = "EMGurus Exams – AI Practice & Question Bank";
  const desc = "Practice Emergency Medicine exams with AI-generated and guru-reviewed questions.";
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", desc);
  let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", window.location.href);
};

export default function Exams() {
  useEffect(() => { setSEO(); }, []);

  return (
    <main>
      <PageHero
        title="Exam Practice"
        subtitle="AI real-time questions and a peer-reviewed bank to master Emergency Medicine."
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Exams</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="sticky top-16 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="font-semibold">Practice Modes</div>
          <div className="flex gap-2">
            <a href="#tab-ai"><Button variant="default">Start AI Practice</Button></a>
            <a href="#tab-bank"><Button variant="outline">Browse Questions</Button></a>
          </div>
        </div>
      </div>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="ai" className="w-full">
          <TabsList>
            <TabsTrigger value="ai" id="tab-ai">AI Practice</TabsTrigger>
            <TabsTrigger value="bank" id="tab-bank">Question Bank</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="mt-6">
            <AiPractice />
          </TabsContent>
          <TabsContent value="bank" className="mt-6">
            <QuestionBank />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
