import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import TabErrorBoundary from "@/components/TabErrorBoundary";
import { announce } from "@/lib/a11y";

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
 * Tab descriptions should only be defined in section configs. Do not add duplicate descriptions inside components.
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabRetryKey, setTabRetryKey] = useState(0);
  const previousViewRef = useRef<string>('');
  const previousTabRef = useRef<string>('');

  // Derive active view and tab from URLSearchParams with fallbacks
  const activeView = useMemo(() => {
    const viewParam = searchParams.get('view');
    const hashView = window.location.hash?.slice(1);
    
    // Precedence: ?view wins over hash, then fallback to firstId
    if (viewParam && ids.includes(viewParam)) return viewParam;
    if (hashView && ids.includes(hashView)) return hashView;
    return firstId;
  }, [searchParams, ids, firstId]);

  const current = sections.find(s => s.id === activeView) || sections[0];
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && current.tabs.some(t => t.id === tabParam)) return tabParam;
    return current.tabs[0]?.id || '';
  }, [searchParams, current]);

  // Update URL when view/tab changes
  const updateURL = useCallback((newView: string, newTab?: string, replace = false) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', newView);
    if (newTab) {
      params.set('tab', newTab);
    } else {
      params.delete('tab');
    }
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    if (replace) {
      window.history.replaceState(null, '', newURL);
    } else {
      window.history.pushState(null, '', newURL);
    }
    setSearchParams(params, { replace });
  }, [searchParams, setSearchParams]);

  // Initial sync - use replaceState to avoid history noise
  useEffect(() => {
    const currentView = searchParams.get('view');
    const currentTab = searchParams.get('tab');
    
    if (!currentView || !ids.includes(currentView)) {
      updateURL(activeView, activeTab, true);
    }
  }, []);

  // Handle hash changes for legacy support
  useEffect(() => {
    const onHash = () => {
      const hashView = window.location.hash?.slice(1);
      if (hashView && ids.includes(hashView) && !searchParams.get('view')) {
        updateURL(hashView, undefined, true);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [ids, searchParams, updateURL]);

  const { state, setOpen, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  // Tab retry handler
  const handleTabRetry = useCallback(() => {
    setTabRetryKey(prev => prev + 1);
  }, []);

  // Handle announcements and title updates on view/tab changes
  useEffect(() => {
    const currentViewTitle = current.title;
    const currentTab = current.tabs.find(t => t.id === activeTab);
    const currentTabTitle = currentTab?.title;

    // Only announce and update title if values actually changed
    if (activeView !== previousViewRef.current || activeTab !== previousTabRef.current) {
      // Update document title
      const titleParts = ['EMGURUS', currentViewTitle];
      if (currentTabTitle) {
        titleParts.push(currentTabTitle);
      }
      document.title = titleParts.join(' • ');

      // Announce to screen readers (skip initial load)
      if (previousViewRef.current || previousTabRef.current) {
        const announcement = `Switched to ${currentViewTitle}${currentTabTitle ? ' — ' + currentTabTitle : ''}`;
        announce(announcement);
      }

      previousViewRef.current = activeView;
      previousTabRef.current = activeTab;
    }
  }, [activeView, activeTab, current]);

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
                    const active = s.id === activeView;
                    const currentTabForSection = active ? activeTab : (s.tabs[0]?.id || '');

                    const go = (newView: string, newTab?: string) => {
                      updateURL(newView, newTab || s.tabs[0]?.id);
                    };
                    return (
                      <div key={s.id} className="flex flex-col">
                        <button
                          onClick={() => go(s.id, currentTabForSection)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors w-full text-left",
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
                              const isActiveTab = active && activeTab === t.id;
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

          <main 
            id="main-content" 
            role="main" 
            tabIndex={-1}
            className={cn(
              "container mx-auto px-2 sm:px-4 py-4 sm:py-6",
              "overflow-x-clip"
            )}
          >
            {/* P6a: swipeable tab row with ARIA + deep links preserved */}
            <Tabs value={activeTab} onValueChange={(newTab) => updateURL(activeView, newTab)}>

              {/* Swipeable row */}
              <TabsList
                role="tablist"
                aria-label={`${current.title} sections`}
                data-testid="tabs-scroll"
                className={cn(
                  "tab-scroll w-full"
                )}
              >
                {current.tabs.map((t) => {
                  const selected = activeTab === t.id;
                  return (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      role="tab"
                      id={`tab-${t.id}`}
                      aria-selected={selected ? "true" : "false"}
                      className={cn(
                        "tab-pill"
                      )}
                      onClick={() => updateURL(activeView, t.id)}
                    >
                      {t.title}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Panels (unchanged except for ARIA linkage) */}
              {current.tabs.map((t) => (
                <TabsContent
                  key={t.id}
                  value={t.id}
                  role="tabpanel"
                  aria-labelledby={`tab-${t.id}`}
                  className={cn(
                    "mt-0"
                  )}
                >
                  {/* Keep your description + boundary exactly as before */}
                  {t.description && (
                    <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
                  )}
                  <div className="border rounded-lg">
                    <TabErrorBoundary tabId={t.id} onRetry={handleTabRetry}>
                      {typeof t.render === "function" ? (t.render as any)() : t.render}
                    </TabErrorBoundary>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
           </main>
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
