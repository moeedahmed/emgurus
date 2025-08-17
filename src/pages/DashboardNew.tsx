import React, { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ErrorBoundary } from "react-error-boundary";

type AppRole = 'admin' | 'guru' | 'user';

interface TabConfig {
  label: string;
  component: React.ComponentType;
  roles: AppRole[];
  description: string;
}

interface SectionConfig {
  label: string;
  tabs: Record<string, TabConfig>;
}

// Lazy load all dashboard components
const BlogsOverview = React.lazy(() => import('@/components/dashboard/blogs/BlogsOverview'));
const MyBlogs = React.lazy(() => import('@/components/dashboard/blogs/MyBlogs'));
const BlogReviewQueue = React.lazy(() => import('@/components/dashboard/blogs/BlogReviewQueue'));
const AdminBlogQueue = React.lazy(() => import('@/components/dashboard/blogs/AdminBlogQueue'));

const ExamsOverview = React.lazy(() => import('@/components/dashboard/exams/ExamsOverview'));
const ExamsAttempts = React.lazy(() => import('@/components/dashboard/exams/ExamsAttempts'));
const ExamsFeedbackList = React.lazy(() => import('@/components/dashboard/exams/ExamsFeedbackList'));
const ExamsProgressMatrix = React.lazy(() => import('@/components/dashboard/exams/ExamsProgressMatrix'));
const ExamReviewQueue = React.lazy(() => import('@/components/dashboard/exams/ExamReviewQueue'));
const ExamGenerator = React.lazy(() => import('@/components/dashboard/exams/ExamGenerator'));

const ConsultationsOverview = React.lazy(() => import('@/components/dashboard/consultations/ConsultationsOverview'));
const Bookings = React.lazy(() => import('@/pages/Bookings'));
const GuruAvailability = React.lazy(() => import('@/components/dashboard/consultations/GuruAvailability'));
const ConsultationPricing = React.lazy(() => import('@/components/dashboard/consultations/ConsultationPricing'));

const ForumsOverview = React.lazy(() => import('@/components/dashboard/forums/ForumsOverview'));
const MyThreadsWithChips = React.lazy(() => import('@/components/dashboard/forums/MyThreadsWithChips'));
const ForumsModerationQueue = React.lazy(() => import('@/components/dashboard/forums/ForumsModerationQueue'));

const GuruApprovals = React.lazy(() => import('@/components/dashboard/users/GuruApprovals'));
const UserDirectory = React.lazy(() => import('@/components/dashboard/users/UserDirectory'));

const SiteSettings = React.lazy(() => import('@/components/dashboard/settings/SiteSettings'));
const AdminDatabaseManager = React.lazy(() => import('@/components/admin/database/DatabaseManager'));

// Create filtered blog components for different statuses
const BlogDrafts = React.lazy(() => Promise.resolve({ 
  default: () => <MyBlogs filter="draft" /> 
}));
const BlogSubmitted = React.lazy(() => Promise.resolve({ 
  default: () => <MyBlogs filter="in_review" /> 
}));
const BlogPublished = React.lazy(() => Promise.resolve({ 
  default: () => <MyBlogs filter="published" /> 
}));
const BlogRejected = React.lazy(() => Promise.resolve({ 
  default: () => <MyBlogs filter="rejected" /> 
}));

// Complete tab registry with role-based access control
const tabRegistry: Record<string, SectionConfig> = {
  blogs: {
    label: 'Blogs',
    tabs: {
      overview: { 
        label: 'Overview', 
        component: BlogsOverview, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Recent posts summary and performance insights.' 
      },
      posts: { 
        label: 'Posts', 
        component: MyBlogs, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Your blog posts filtered by status.' 
      },
      reviews: { 
        label: 'Reviews', 
        component: BlogReviewQueue, 
        roles: ['guru', 'admin'], 
        description: 'Assigned blogs for review and approval.' 
      },
      queue: { 
        label: 'Queue', 
        component: AdminBlogQueue, 
        roles: ['admin'], 
        description: 'All blog submissions for management.' 
      },
    },
  },
  exams: {
    label: 'Exams',
    tabs: {
      overview: { 
        label: 'Overview', 
        component: ExamsOverview, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Exam attempt stats, scores, and accuracy.' 
      },
      attempts: { 
        label: 'Attempts', 
        component: ExamsAttempts, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Your recent practice and exam sessions.' 
      },
      feedback: { 
        label: 'Feedback', 
        component: ExamsFeedbackList, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Questions you flagged and your notes.' 
      },
      progress: { 
        label: 'Progress', 
        component: ExamsProgressMatrix, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Skill matrix showing strengths and weak areas.' 
      },
      reviews: { 
        label: 'Reviews', 
        component: ExamReviewQueue, 
        roles: ['guru', 'admin'], 
        description: 'Pending exam questions for review.' 
      },
      generate: { 
        label: 'Generate', 
        component: ExamGenerator, 
        roles: ['admin'], 
        description: 'AI-powered question generation tools.' 
      },
    },
  },
  consultations: {
    label: 'Consultations',
    tabs: {
      overview: { 
        label: 'Overview', 
        component: ConsultationsOverview, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Upcoming sessions and consultation stats.' 
      },
      bookings: { 
        label: 'Bookings', 
        component: Bookings, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Your consultation history and upcoming sessions.' 
      },
      availability: { 
        label: 'Availability', 
        component: GuruAvailability, 
        roles: ['guru', 'admin'], 
        description: 'Configure your weekly availability slots.' 
      },
      pricing: { 
        label: 'Pricing', 
        component: ConsultationPricing, 
        roles: ['guru', 'admin'], 
        description: 'Set your consultation hourly rate.' 
      },
    },
  },
  forums: {
    label: 'Forums',
    tabs: {
      overview: { 
        label: 'Overview', 
        component: ForumsOverview, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Your forum activity at a glance.' 
      },
      threads: { 
        label: 'Threads', 
        component: MyThreadsWithChips, 
        roles: ['user', 'guru', 'admin'], 
        description: 'Your questions and answers with filters.' 
      },
      moderation: { 
        label: 'Moderation', 
        component: ForumsModerationQueue, 
        roles: ['guru', 'admin'], 
        description: 'Review and resolve flagged posts.' 
      },
    },
  },
  users: {
    label: 'Users',
    tabs: {
      approvals: { 
        label: 'Approvals', 
        component: GuruApprovals, 
        roles: ['admin'], 
        description: 'Review and approve guru applications.' 
      },
      directory: { 
        label: 'Directory', 
        component: UserDirectory, 
        roles: ['admin'], 
        description: 'Searchable list of all platform users.' 
      },
    },
  },
  settings: {
    label: 'Settings',
    tabs: {
      site: { 
        label: 'Site', 
        component: SiteSettings, 
        roles: ['admin'], 
        description: 'Configure global platform settings.' 
      },
      database: { 
        label: 'Database', 
        component: AdminDatabaseManager, 
        roles: ['admin'], 
        description: 'Manage curriculum, exams, and knowledge base.' 
      },
    },
  },
};

function TabErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <Card className="p-6 text-center">
      <h3 className="text-sm font-medium mb-2">This section failed to load</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
        Retry
      </Button>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center">
      <p className="text-muted-foreground">Nothing here yet.</p>
    </Card>
  );
}

function Sidebar({ 
  availableSections, 
  currentView, 
  currentTab, 
  onNavigate,
  className = "" 
}: {
  availableSections: Array<{ key: string; config: SectionConfig }>;
  currentView: string;
  currentTab: string;
  onNavigate: (view: string, tab: string) => void;
  className?: string;
}) {
  return (
    <div className={`bg-card border-r ${className}`}>
      <div className="p-4 border-b">
        <h2 className="font-semibold">Dashboard</h2>
      </div>
      <nav className="p-2 space-y-1">
        {availableSections.map(({ key: sectionKey, config }) => (
          <div key={sectionKey}>
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {config.label}
            </div>
            {Object.entries(config.tabs).map(([tabKey, tabConfig]) => (
              <Button
                key={`${sectionKey}-${tabKey}`}
                variant={currentView === sectionKey && currentTab === tabKey ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => onNavigate(sectionKey, tabKey)}
              >
                {tabConfig.label}
              </Button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

export default function DashboardNew() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles, isLoading: rolesLoading } = useRoles();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get current view and tab from URL params
  const currentView = searchParams.get('view') || '';
  const currentTab = searchParams.get('tab') || '';

  // Filter sections based on user roles
  const availableSections = useMemo(() => {
    return Object.entries(tabRegistry)
      .map(([key, config]) => ({
        key,
        config: {
          ...config,
          tabs: Object.fromEntries(
            Object.entries(config.tabs).filter(([_, tabConfig]) =>
              tabConfig.roles.some(role => roles.includes(role))
            )
          ),
        },
      }))
      .filter(({ config }) => Object.keys(config.tabs).length > 0);
  }, [roles]);

  // Get the first available section/tab for fallback
  const defaultSection = availableSections[0];
  const defaultTab = defaultSection ? Object.keys(defaultSection.config.tabs)[0] : '';

  // Navigate to default if no valid current selection
  useEffect(() => {
    if (rolesLoading || !defaultSection) return;

    const validView = availableSections.find(s => s.key === currentView);
    const validTab = validView && validView.config.tabs[currentTab];

    if (!validView || !validTab) {
      const params = new URLSearchParams();
      params.set('view', defaultSection.key);
      params.set('tab', defaultTab);
      setSearchParams(params, { replace: true });
    }
  }, [currentView, currentTab, availableSections, defaultSection, defaultTab, rolesLoading, setSearchParams]);

  // Navigation handler
  const handleNavigate = (view: string, tab: string) => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('tab', tab);
    setSearchParams(params);
    setSidebarOpen(false);
  };

  // Get current tab config
  const currentSection = availableSections.find(s => s.key === currentView);
  const currentTabConfig = currentSection?.config.tabs[currentTab];

  useEffect(() => {
    document.title = "Dashboard | EM Gurus";
  }, []);

  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!availableSections.length) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header with Tab Navigation */}
      <div className="lg:hidden">
        <div className="border-b bg-card">
          <div className="flex items-center justify-between p-4">
            <h1 className="font-semibold">Dashboard</h1>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Sidebar
                  availableSections={availableSections}
                  currentView={currentView}
                  currentTab={currentTab}
                  onNavigate={handleNavigate}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        
        {/* Mobile Tab Navigation */}
        {currentSection && (
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="px-4 py-2">
              <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
                {Object.entries(currentSection.config.tabs).map(([tabKey, tabConfig]) => (
                  <Button
                    key={tabKey}
                    variant={currentTab === tabKey ? "default" : "ghost"}
                    size="sm"
                    className="whitespace-nowrap flex-shrink-0"
                    onClick={() => handleNavigate(currentView, tabKey)}
                  >
                    {tabConfig.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar
          availableSections={availableSections}
          currentView={currentView}
          currentTab={currentTab}
          onNavigate={handleNavigate}
          className="hidden lg:block w-64 min-h-screen"
        />

        {/* Main Content */}
        <div className="flex-1 min-h-screen">
          {currentTabConfig ? (
            <div className="p-4">
              {/* Desktop Header */}
              <div className="hidden lg:block mb-6">
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Dashboard › {currentSection?.config.label}
                  </div>
                  <h1 className="text-2xl font-bold">
                    {currentSection?.config.label} › {currentTabConfig.label}
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {currentTabConfig.description}
                </p>
                
                {/* Desktop Tab Bar */}
                {currentSection && (
                  <div className="flex space-x-1 border-b pb-2 mb-6">
                    {Object.entries(currentSection.config.tabs).map(([tabKey, tabConfig]) => (
                      <Button
                        key={tabKey}
                        variant={currentTab === tabKey ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleNavigate(currentView, tabKey)}
                      >
                        {tabConfig.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Content Header */}
              <div className="lg:hidden mb-4">
                <h2 className="text-lg font-semibold mb-1">{currentTabConfig.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {currentTabConfig.description}
                </p>
              </div>

              {/* Tab Content with Error Boundary */}
              <ErrorBoundary
                FallbackComponent={TabErrorFallback}
                resetKeys={[currentView, currentTab]}
                onError={(error, errorInfo) => {
                  console.error('Dashboard tab error:', error, errorInfo);
                }}
              >
                <Suspense fallback={<LoadingSkeleton />}>
                  <currentTabConfig.component />
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}