import React, { lazy } from 'react';
import { BookOpen, Stethoscope, GraduationCap, MessagesSquare, UsersRound, Settings as SettingsIcon } from 'lucide-react';

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

const EmptyPanel = () => (
  React.createElement('div', { className: 'p-4 border rounded-md bg-muted/30' },
    React.createElement('div', { className: 'font-medium' }, 'Nothing here yet'),
    React.createElement('div', { className: 'text-sm text-muted-foreground mt-1' }, 
      'This panel is temporarily unavailable.')
  )
);

const safeLazy = (factory: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(async () => {
    try { 
      return await factory(); 
    } catch (e) {
      console.warn('Falling back to EmptyPanel for failed import:', e);
      return { default: EmptyPanel };
    }
  });

// User components
const BlogsOverview = safeLazy(() => import('../components/dashboard/blogs/BlogsOverview'));
const MyBlogs = safeLazy(() => import('../components/dashboard/blogs/MyBlogs'));
const ExamsOverview = safeLazy(() => import('../components/dashboard/exams/ExamsOverview'));
const ExamsAttempts = safeLazy(() => import('../components/dashboard/exams/ExamsAttempts'));
const ExamsProgressMatrix = safeLazy(() => import('../components/dashboard/exams/ExamsProgressMatrix'));
const ExamsFeedbackList = safeLazy(() => import('../components/dashboard/exams/ExamsFeedbackList'));
const ConsultOverview = safeLazy(() => import('../components/dashboard/consultations/ConsultationsOverview'));
const ForumsOverview = safeLazy(() => import('../components/dashboard/forums/ForumsOverview'));
const MyThreadsWithChips = safeLazy(() => import('../components/dashboard/forums/MyThreadsWithChips'));

// Real page components wrapped for dashboard use
const Bookings = safeLazy(() => import('../pages/Bookings').then(mod => ({ default: (props: any) => React.createElement(mod.default, { embedded: true, ...props }) })));
const QuestionBank = safeLazy(() => import('../pages/exams/ReviewedQuestionBank').then(mod => ({ default: (props: any) => React.createElement(mod.default, { embedded: true, ...props }) })));

// Guru components
const GuruPricing = safeLazy(() => import('../pages/guru/Pricing'));
const GuruAvailability = safeLazy(() => import('../pages/guru/Availability'));
const ExamsReviewQueue = safeLazy(() => import('../pages/guru/ExamsReviewQueue'));
const ForumsModeration = safeLazy(() => import('../components/dashboard/forums/ForumsModerationQueue'));

// Admin components
const AdminGeneration = safeLazy(() => import('../components/admin/AdminGeneration'));
const ApproveGurus = safeLazy(() => import('../pages/admin/ApproveGurus').then(mod => ({ default: (props: any) => React.createElement(mod.default, { embedded: true, ...props }) })));
const ExamsAICuration = safeLazy(() => import('../pages/admin/ExamsAICuration'));
const SettingsPage = safeLazy(() => import('../pages/Settings'));

export const BASE_SECTIONS: WorkspaceSection[] = [
  {
    id: 'blogs',
    title: 'Blogs',
    description: 'Write, track and publish your posts.',
    icon: BookOpen,
    tabs: [
      { id: 'overview', title: 'Overview', component: BlogsOverview },
      { id: 'posts', title: 'Posts', component: MyBlogs },
    ],
  },
  {
    id: 'exams',
    title: 'Exams',
    description: 'Practice, review and track your exam progress.',
    icon: GraduationCap,
    tabs: [
      { id: 'overview', title: 'Overview', component: ExamsOverview },
      { id: 'attempts', title: 'Attempts', component: ExamsAttempts },
      { id: 'bank', title: 'Bank', component: QuestionBank },
      { id: 'progress', title: 'Progress', component: ExamsProgressMatrix },
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
      { id: 'threads', title: 'Threads', component: MyThreadsWithChips },
    ],
  },
];

export const EXTRA_TABS_BY_ROLE: Record<'guru'|'admin', Partial<Record<string, WorkspaceTab[]>>> = {
  guru: {
    exams: [
      { id: 'reviews', title: 'Reviews', component: ExamsReviewQueue, roles: ['guru','admin'] },
    ],
    consultations: [
      { id: 'slots', title: 'Slots', component: GuruAvailability, roles: ['guru','admin'] },
      { id: 'pricing', title: 'Pricing', component: GuruPricing, roles: ['guru','admin'] },
    ],
    forums: [
      { id: 'moderation', title: 'Moderation', component: ForumsModeration, roles: ['guru','admin'] },
    ],
  },
  admin: {
    blogs: [
      { id: 'reviews', title: 'Reviews', component: EmptyPanel, roles: ['admin'] },
      { id: 'analytics', title: 'Analytics', component: EmptyPanel, roles: ['admin'] },
    ],
    exams: [
      { id: 'generate', title: 'Generate', component: AdminGeneration, roles: ['admin'] },
      { id: 'reviews', title: 'Reviews', component: ExamsAICuration, roles: ['admin'] },
    ],
    consultations: [
      { id: 'analytics', title: 'Analytics', component: EmptyPanel, roles: ['admin'] },
    ],
    forums: [
      { id: 'moderation', title: 'Moderation', component: ForumsModeration, roles: ['admin'] },
    ],
    users: [
      { id: 'approvals', title: 'Approvals', component: ApproveGurus, roles: ['admin'] },
      { id: 'directory', title: 'Directory', component: EmptyPanel, roles: ['admin'] },
    ],
    settings: [
      { id: 'site', title: 'Site', component: SettingsPage, roles: ['admin'] },
    ],
  },
};

export function buildSectionsForRoles(flags: { isAdmin: boolean; isGuru: boolean }): WorkspaceSection[] {
  const byId: Record<string, WorkspaceSection> = {};
  BASE_SECTIONS.forEach(s => byId[s.id] = { ...s, tabs: [...s.tabs] });

  if (flags.isAdmin) {
    byId['users'] ??= { id: 'users', title: 'Users', icon: UsersRound, tabs: [] };
    byId['settings'] ??= { id: 'settings', title: 'Settings', icon: SettingsIcon, tabs: [] };
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