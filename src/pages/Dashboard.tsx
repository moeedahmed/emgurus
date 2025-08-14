import React, { Suspense, useEffect } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { buildSectionsForRoles } from '@/config/workspaceRegistry';
import WorkspaceLayout from '@/components/dashboard/WorkspaceLayout';
import { SafeMount } from '@/components/common/SafeMount';

const Dashboard = () => {
  const { isAdmin, isGuru, isLoading } = useRoles();
  
  useEffect(() => {
    document.title = "Dashboard | EM Gurus";
  }, []);
  
  const sections = buildSectionsForRoles({ isAdmin: !!isAdmin, isGuru: !!isGuru });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceLayout 
      title="Workspace" 
      sections={sections.map(section => ({
        ...section,
        tabs: section.tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          description: tab.description,
          render: () => (
            <Suspense fallback={<div className="text-sm text-muted-foreground p-4">Loading…</div>}>
              <SafeMount component={tab.component} fallbackText={`${tab.title} component failed to load`} />
            </Suspense>
          )
        }))
      }))} 
      defaultSectionId="blogs" 
    />
  );
};

export default Dashboard;
