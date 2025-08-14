import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import WorkspaceErrorBoundary from "@/components/dashboard/WorkspaceErrorBoundary";

export type WorkspaceSection = {
  id: string;            // e.g. "blogs"
  title: string;         // label
  description?: string;  // section-level description
  icon?: React.ComponentType<{ className?: string }>;
  tabs: Array<{
    id: string;          // e.g. "pending"
    title: string;       // tab label
    description?: string; // one-liner description
    render: React.ReactNode | (() => React.ReactNode);
  }>;
};

export function WorkspaceLayoutInner({
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

  // Use URLSearchParams instead of hash
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') || firstId;
  const tabParam = searchParams.get('tab');

  const [sectionId, setSectionId] = useState<string>(() => {
    return ids.includes(viewParam) ? viewParam : firstId;
  });

  useEffect(() => {
    const currentView = searchParams.get('view');
    if (!currentView || !ids.includes(currentView)) {
      // Set default view if missing or invalid
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', firstId);
      setSearchParams(newParams, { replace: true });
      setSectionId(firstId);
    } else {
      setSectionId(currentView);
    }
  }, [firstId, ids, searchParams, setSearchParams]);

  const current = sections.find(s => s.id === sectionId) || sections[0];

  const { state, setOpen, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const [searchSync, setSearchSync] = useState(0);

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar
        variant="sidebar"
        collapsible="offcanvas"
        className="bg-sidebar border-r"
      >
        <SidebarContent className="pt-[var(--header-h)]">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 py-1 text-sm font-semibold">{title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav className="flex-1 overflow-y-auto flex flex-col gap-1 p-1 pr-2 max-h-[calc(100vh-var(--header-h)-4rem)]">
                  {sections.map((s) => {
                    const Icon = s.icon as any;
                    const active = s.id === sectionId;
                    const currentTab = searchParams.get('tab') || (s.tabs[0]?.id || '');

                    const go = (sid: string, tid?: string) => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('view', sid);
                      if (tid) newParams.set('tab', tid); else newParams.delete('tab');
                      setSearchParams(newParams, { replace: true });
                      setSectionId(sid);
                      setSearchSync((v) => v + 1);
                    };
                    return (
                      <div key={s.id} className="flex flex-col">
                        <button
                          onClick={() => go(s.id, currentTab)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                            active ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50 text-foreground"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {!collapsed && <span>{s.title}</span>}
                        </button>
                        {/* sub-tabs */}
                        {active && !collapsed && (
                          <div className="ml-6 mt-1 mb-2 flex flex-col">
                            {s.tabs.map((t) => {
                              const isActiveTab = currentTab === t.id;
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => go(s.id, t.id)}
                                  className={cn(
                                    "text-left text-xs rounded-md px-2 py-1 transition-colors",
                                    isActiveTab ? "bg-muted font-medium text-primary" : "hover:bg-muted/50 text-muted-foreground"
                                  )}
                                  aria-current={isActiveTab ? "true" : undefined}
                                >
                                  {t.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="pt-[var(--header-h)]">
          <header className="sticky top-[var(--header-h)] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="h-12 flex items-center gap-3 px-3">
              <SidebarTrigger className="lg:hidden" />
              <div className="text-sm text-muted-foreground">{title}</div>
              <div className="text-sm">/</div>
              <div className="font-medium">{current.title}</div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-6">
            {current.description && (
              <div className="mb-6 text-sm text-muted-foreground">{current.description}</div>
            )}
            <Tabs key={`${sectionId}:${searchParams.get('tab') || ''}:${searchSync}`}
              defaultValue={(current.tabs.find(t => t.id === searchParams.get('tab'))?.id) || current.tabs[0]?.id}
              value={(current.tabs.find(t => t.id === searchParams.get('tab'))?.id) || current.tabs[0]?.id}
              onValueChange={(tabId) => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('view', sectionId);
                newParams.set('tab', tabId);
                setSearchParams(newParams, { replace: true });
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-full overflow-x-auto overscroll-x-contain whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <TabsList className="inline-flex gap-1 flex-nowrap min-w-max px-2">
                    {current.tabs.map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className="shrink-0">{t.title}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {current.tabs.map((t) => (
                <TabsContent key={t.id} value={t.id} className="mt-0">
                  {t.description && t.description !== current.description && (
                    <div className="mb-3 text-sm text-muted-foreground">{t.description}</div>
                  )}
                  <div className="border rounded-lg">
                    <WorkspaceErrorBoundary>
                      {typeof t.render === 'function' ? (t.render as any)() : t.render}
                    </WorkspaceErrorBoundary>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </SidebarInset>
    </div>
  );
}

export default function WorkspaceLayout(props: {
  title: string;
  sections: WorkspaceSection[];
  defaultSectionId?: string;
}) {
  return (
    <SidebarProvider>
      <WorkspaceLayoutInner {...props} />
    </SidebarProvider>
  );
}
