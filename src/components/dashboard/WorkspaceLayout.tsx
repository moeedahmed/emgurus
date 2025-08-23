import React, { useEffect, useMemo, useState } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type WorkspaceSection = {
  id: string;            // e.g. "blogs"
  title: string;         // label
  icon?: React.ComponentType<{ className?: string }>;
  tabs: Array<{
    id: string;          // e.g. "pending"
    title: string;       // tab label
    description?: string; // one-liner description
    render: React.ReactNode | (() => React.ReactNode);
  }>;
};

/**
 * DEVELOPER NOTE: WorkspaceLayout is the canonical source for tab descriptions.
 * Do not add duplicate top-level descriptions inside components.
 * Use only the section description defined in WorkspaceLayout.
 */

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
                    const search = new URLSearchParams(window.location.search);
                    const currentTab = search.get('tab') || (s.tabs[0]?.id || '');

                    const go = (sid: string, tid?: string) => {
                      const sp = new URLSearchParams(window.location.search);
                      if (tid) sp.set('tab', tid); else sp.delete('tab');
                      const qs = sp.toString();
                      const nextUrl = qs ? `${location.pathname}?${qs}#${sid}` : `${location.pathname}#${sid}`;
                      history.replaceState(null, '', nextUrl);
                      // proactively sync local state so content switches immediately
                      setSectionId(sid);
                      // force re-render so Tabs remount reflects updated ?tab
                      setSearchSync((v) => v + 1);
                    };
                    return (
                      <div key={s.id} className="flex flex-col">
                        <a
                          href={`#${s.id}`}
                          onClick={(e) => { e.preventDefault(); go(s.id, currentTab); }}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                            active ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50 text-foreground"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {!collapsed && <span>{s.title}</span>}
                        </a>
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

          <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
            <Tabs key={`${sectionId}:${new URLSearchParams(window.location.search).get('tab') || ''}:${searchSync}`}
              defaultValue={(current.tabs.find(t => t.id === new URLSearchParams(window.location.search).get('tab'))?.id) || current.tabs[0]?.id}
              value={undefined /* uncontrolled per remount */}
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
                  {t.description && (
                    <div className="mb-4 text-sm text-muted-foreground">{t.description}</div>
                  )}
                  <div className="border rounded-lg">
                    {typeof t.render === 'function' ? (t.render as any)() : t.render}
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
