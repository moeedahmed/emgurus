import React, { useEffect, useMemo, useState } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type WorkspaceSection = {
  id: string;            // e.g. "blogs"
  title: string;         // label
  icon?: React.ComponentType<{ className?: string }>;
  tabs: Array<{
    id: string;          // e.g. "pending"
    title: string;       // tab label
    render: React.ReactNode | (() => React.ReactNode);
  }>;
};

export default function WorkspaceLayout({
  title,
  sections,
  defaultSectionId,
}: {
  title: string;
  sections: WorkspaceSection[];
  defaultSectionId?: string;
}) {
  const ids = useMemo(() => sections.map(s => s.id), [sections]);
  const firstId = defaultSectionId || ids[0];

  const [sectionId, setSectionId] = useState<string>(() => (window.location.hash?.slice(1) || firstId));
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash || !ids.includes(hash)) {
      // Set first section on load if missing or invalid
      window.location.hash = `#${firstId}`;
      setSectionId(firstId);
    } else {
      setSectionId(hash);
    }
    const onHash = () => {
      const next = window.location.hash?.slice(1);
      if (next && ids.includes(next)) setSectionId(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [firstId, ids]);

  const current = sections.find(s => s.id === sectionId) || sections[0];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sm font-semibold">{title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <nav className="flex flex-col gap-1 p-1">
                  {sections.map((s) => {
                    const Icon = s.icon as any;
                    const active = s.id === sectionId;
                    return (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active ? "bg-muted text-primary" : "hover:bg-muted/50"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                        <span>{s.title}</span>
                      </a>
                    );
                  })}
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="h-12 flex items-center gap-3 px-3">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">{title}</div>
              <div className="text-sm">/</div>
              <div className="font-medium">{current.title}</div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-6">
            <Tabs key={sectionId} defaultValue={current.tabs[0]?.id} value={undefined /* uncontrolled per remount */}>
              <div className="flex items-center justify-between mb-3">
                <TabsList>
                  {current.tabs.map((t) => (
                    <TabsTrigger key={t.id} value={t.id}>{t.title}</TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {current.tabs.map((t) => (
                <TabsContent key={t.id} value={t.id} className="mt-0">
                  <div className="border rounded-lg">
                    {typeof t.render === 'function' ? (t.render as any)() : t.render}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
