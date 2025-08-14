import React, { lazy } from 'react';
import { BookOpen, Stethoscope, GraduationCap, MessagesSquare, UsersRound, Settings } from 'lucide-react';

export type WorkspaceTab = {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  description?: string;
  roles?: Array<'user'|'guru'|'admin'>;
};

export type WorkspaceSection = {
  id: string;
  title: string;
  description?: string;
  tabs: WorkspaceTab[];
  icon?: React.ComponentType<{ className?: string }>;
};

function NotFoundStub({ title }: { title?: string }) {
  return React.createElement(
    'div',
    { className: 'text-sm text-muted-foreground p-6 border rounded-lg' },
    title || 'This panel is not available yet.'
  );
}

const safeLazy = (factory: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(async () => {
    try { 
      return await factory(); 
    } catch { 
      return { default: NotFoundStub }; 
    }
  });

const AdminGeneration = safeLazy(async () => {
  try {
    return await import('../components/admin/AdminGeneration');
  } catch {
    return await import('../pages/admin/ExamsAICuration');
  }
});

const BlogsOverview = safeLazy(() => import('../components/dashboard/blogs/BlogsOverview'));
const MyBlogs = safeLazy(() => import('../components/dashboard/blogs/MyBlogs'));
const BlogReviews = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const BlogSubmissionQueue = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const BlogsAnalytics = safeLazy(() => Promise.resolve({ default: NotFoundStub }));

const ExamsOverview = safeLazy(() => import('../components/dashboard/exams/ExamsOverview'));
const ExamsAttempts = safeLazy(() => import('../components/dashboard/exams/ExamsAttempts'));
const ExamsProgressMatrix = safeLazy(() => import('../components/dashboard/exams/ExamsProgressMatrix'));
const ExamsFeedbackList = safeLazy(() => import('../components/dashboard/exams/ExamsFeedbackList'));

const ExamReviews = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const ReviewedBank = safeLazy(() => Promise.resolve({ default: NotFoundStub }));

const ConsultOverview = safeLazy(() => import('../components/dashboard/consultations/ConsultationsOverview'));
const Bookings = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const Availability = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const Pricing = safeLazy(() => Promise.resolve({ default: NotFoundStub }));

const ForumsOverview = safeLazy(() => import('../components/dashboard/forums/ForumsOverview'));
const MyThreadsWithChips = safeLazy(() => import('../components/dashboard/forums/MyThreadsWithChips'));
const ForumsModeration = safeLazy(() => import('../components/dashboard/forums/ForumsModerationQueue'));

const UsersManage = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const SettingsPanel = safeLazy(() => Promise.resolve({ default: NotFoundStub }));
const GuruApprovals = safeLazy(() => Promise.resolve({ default: NotFoundStub }));

export const BASE_SECTIONS: WorkspaceSection[] = [
  {
    id: 'blogs',
    title: 'Blogs',
    description: 'Write, track and publish your posts.',
    icon: BookOpen,
    tabs: [
      { id: 'overview', title: 'Overview', component: BlogsOverview },
      { id: 'my-blogs', title: 'My Blogs', component: MyBlogs },
    ],
  },
  {
    id: 'exams',
    title: 'Exams',
    description: 'Practice, review and track your exam progress.',
    icon: GraduationCap,
    tabs: [
      { id: 'overview', title: 'Overview', component: ExamsOverview },
      { id: 'attempts', title: 'My Attempts', component: ExamsAttempts },
      { id: 'progress', title: 'Progress Matrix', component: ExamsProgressMatrix },
      { id: 'feedback', title: 'Feedback', component: ExamsFeedbackList },
    ],
  },
  {
    id: 'consultations',
    title: 'Consultations',
    description: 'Manage your consults and bookings.',
    icon: Stethoscope,
    tabs: [
      { id: 'overview', title: 'Overview', component: ConsultOverview },
      { id: 'bookings', title: 'Bookings', component: Bookings },
    ],
  },
  {
    id: 'forums',
    title: 'Forums',
    description: 'Discuss and collaborate with the community.',
    icon: MessagesSquare,
    tabs: [
      { id: 'overview', title: 'Overview', component: ForumsOverview },
      { id: 'my-threads', title: 'My Threads', component: MyThreadsWithChips },
    ],
  },
];

export const EXTRA_TABS_BY_ROLE: Record<'guru'|'admin', Partial<Record<string, WorkspaceTab[]>>> = {
  guru: {
    blogs: [
      { id: 'reviews', title: 'Reviews', component: BlogReviews, roles: ['guru','admin'] },
      { id: 'analytics', title: 'Analytics', component: BlogsAnalytics, roles: ['guru','admin'] },
    ],
    exams: [
      { id: 'reviews', title: 'Reviews', component: ExamReviews, roles: ['guru','admin'] },
      { id: 'reviewed-bank', title: 'Reviewed Bank', component: ReviewedBank, roles: ['guru','admin'] },
    ],
    consultations: [
      { id: 'availability', title: 'Availability', component: Availability, roles: ['guru','admin'] },
      { id: 'pricing', title: 'Pricing', component: Pricing, roles: ['guru','admin'] },
    ],
    forums: [
      { id: 'moderation', title: 'Moderation Queue', component: ForumsModeration, roles: ['guru','admin'] },
    ],
  },
  admin: {
    blogs: [
      { id: 'submission-queue', title: 'Submission Queue', component: BlogSubmissionQueue, roles: ['admin'] },
    ],
    exams: [
      { id: 'generation', title: 'Generation', component: AdminGeneration, roles: ['admin'] },
      { id: 'reviews', title: 'Reviews', component: ExamReviews, roles: ['admin'] },
      { id: 'reviewed-bank', title: 'Reviewed Bank', component: ReviewedBank, roles: ['admin'] },
    ],
    consultations: [
      { id: 'analytics', title: 'Analytics', component: BlogsAnalytics, roles: ['admin'] },
    ],
    forums: [
      { id: 'moderation', title: 'Moderation Queue', component: ForumsModeration, roles: ['admin'] },
    ],
    users: [
      { id: 'manage', title: 'Manage Users', component: UsersManage, roles: ['admin'] },
      { id: 'guru-approvals', title: 'Guru Approvals', component: GuruApprovals, roles: ['admin'] },
    ],
    settings: [
      { id: 'general', title: 'Settings', component: SettingsPanel, roles: ['admin'] },
    ],
  },
};

export function buildSectionsForRoles(flags: { isAdmin: boolean; isGuru: boolean }): WorkspaceSection[] {
  const byId: Record<string, WorkspaceSection> = {};
  BASE_SECTIONS.forEach(s => byId[s.id] = { ...s, tabs: [...s.tabs] });

  if (flags.isAdmin) {
    byId['users'] ??= { id: 'users', title: 'Users', icon: UsersRound, tabs: [] };
    byId['settings'] ??= { id: 'settings', title: 'Settings', icon: Settings, tabs: [] };
  }

  const rolesToApply: Array<'guru'|'admin'> = [
    ...(flags.isGuru ? (['guru'] as const) : []),
    ...(flags.isAdmin ? (['admin'] as const) : []),
  ];

  for (const r of rolesToApply) {
    const extras = EXTRA_TABS_BY_ROLE[r] || {};
    Object.entries(extras).forEach(([sectionId, tabs]) => {
      if (!tabs || tabs.length === 0) return;
      if (!byId[sectionId]) byId[sectionId] = { id: sectionId, title: sectionId[0].toUpperCase()+sectionId.slice(1), tabs: [] };
      const existing = byId[sectionId].tabs;
      tabs.forEach(tab => {
        const idx = existing.findIndex(t => t.id === tab.id);
        if (idx >= 0) existing[idx] = tab; else existing.push(tab);
      });
    });
  }

  Object.values(byId).forEach(sec => {
    if (!sec.description) return;
    sec.tabs = sec.tabs.map(t => (t.description === sec.description ? { ...t, description: undefined } : t));
  });

  Object.values(byId).forEach(sec => {
    sec.tabs.sort((a,b) => {
      if (a.id === 'overview') return -1;
      if (b.id === 'overview') return  1;
      return a.title.localeCompare(b.title);
    });
  });

  const order = ['blogs','exams','consultations','forums','users','settings'];
  return Object.values(byId).sort((a,b) => (order.indexOf(a.id) - order.indexOf(b.id)));
}