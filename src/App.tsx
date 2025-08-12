import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Exams from "./pages/Exams";
import Auth from "./pages/Auth";
import ReviewedQuestionBank from "@/pages/exams/ReviewedQuestionBank";
import ReviewedQuestionDetail from "@/pages/exams/ReviewedQuestionDetail";
import NotFound from "./pages/NotFound";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogCategory from "./pages/BlogCategory";
import Blogs from "./pages/Blogs";
import BlogDetail from "./pages/BlogDetail";
import EditorNew from "./pages/blogs/EditorNew";
import EditorEdit from "./pages/blogs/EditorEdit";
import BlogsDashboard from "./pages/blogs/Dashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import Dashboard from "./pages/Dashboard";
import DashboardUser from "./pages/DashboardUser";
import DashboardGuru from "./pages/DashboardGuru";
import DashboardAdmin from "./pages/DashboardAdmin";
import SiteLayout from "@/components/SiteLayout";
import Forums from "./pages/Forums";
import Consultations from "./pages/Consultations";
import UserProgress from "./pages/user/Progress";
import GuruQuestions from "./pages/guru/Questions";
import GuruReviewQueue from "./pages/guru/ReviewQueue";
import GuruAvailability from "./pages/guru/Availability";
import ExamsAICuration from "./pages/admin/ExamsAICuration";
import ExamsReviewQueue from "./pages/guru/ExamsReviewQueue";
import ApproveGurus from "./pages/admin/ApproveGurus";
import ModeratePosts from "./pages/admin/ModeratePosts";
import AssignReviews from "./pages/admin/AssignReviews";
import Taxonomy from "./pages/admin/Taxonomy";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Bookings from "./pages/Bookings";

import ForumCategory from "./pages/ForumCategory";
import ComingSoon from "./pages/ComingSoon";
import About from "./pages/About";
import ThreadView from "@/pages/ThreadView";
import ErrorBoundary from "@/components/ErrorBoundary";
import AiPracticeConfig from "@/pages/exams/AiPracticeConfig";
import AiPracticeSession from "@/pages/exams/AiPracticeSession";
import QuestionBankPage from "@/pages/exams/QuestionBankPage";
import QuestionDetail from "@/pages/exams/QuestionDetail";
import GenerateExamQuestion from "@/pages/tools/GenerateExamQuestion";
import MyExamDrafts from "@/pages/tools/MyExamDrafts";
import ReviewedByMe from "@/pages/guru/ReviewedByMe";
import PricingPage from "./pages/Pricing";
import { useRoles } from "@/hooks/useRoles";
import RoleRedirector from "@/components/auth/RoleRedirector";
import AuthLandingGuard from "@/components/auth/AuthLandingGuard";
import MarkedQuestionsAdmin from "./pages/admin/MarkedQuestions";
import QuestionSetsAdmin from "./pages/admin/QuestionSets";
import ReviewedExamSession from "@/pages/exams/ReviewedExamSession";


function LegacyBlogsDashboardRedirect() {
  const { roles } = useRoles();
  if (roles.includes('admin')) return <Navigate to="/dashboard/admin#blogs-admin" replace />;
  if (roles.includes('guru')) return <Navigate to="/dashboard/guru#blogs" replace />;
  return <Navigate to="/dashboard/user" replace />;
}
function LegacyBlogSlugRedirect() {
  const slug = window.location.pathname.split('/').pop() || '';
  return <Navigate to={`/blogs/${slug}`} replace />;
}
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthLandingGuard />
          <Routes>
            <Route element={<SiteLayout />}> 
              <Route path="/" element={<Index />} />
               <Route path="/exams" element={<Exams />} />
               <Route path="/exams/ai-practice" element={
                 <ErrorBoundary>
                   <AiPracticeConfig />
                 </ErrorBoundary>
               } />
               <Route path="/exams/ai-practice/session/:id" element={
                 <ErrorBoundary>
                   <AiPracticeSession />
                 </ErrorBoundary>
               } />
               <Route path="/exams/reviewed" element={
                 <ErrorBoundary>
                   {/* Reviewed Question Bank (EM only) */}
                   <ReviewedQuestionBank />
                 </ErrorBoundary>
               } />
               <Route path="/exams/reviewed/:id" element={
                 <ErrorBoundary>
                   <ReviewedQuestionDetail />
                 </ErrorBoundary>
               } />
               <Route path="/exams/question-bank" element={
                 <ErrorBoundary>
                   <QuestionBankPage />
                 </ErrorBoundary>
               } />
               <Route path="/exams/question/:id" element={
                 <ErrorBoundary>
                   <QuestionDetail />
                 </ErrorBoundary>
               } />
              <Route path="/quiz" element={<Navigate to="/exams" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blogs/:slug" element={<BlogDetail />} />
              <Route path="/blogs/editor/new" element={<ProtectedRoute><EditorNew /></ProtectedRoute>} />
              <Route path="/blogs/editor/:id" element={<ProtectedRoute><EditorEdit /></ProtectedRoute>} />
              <Route path="/blogs/new" element={<Navigate to="/blogs/editor/new" replace />} />
              <Route path="/blogs/dashboard" element={<ProtectedRoute><BlogsDashboard /></ProtectedRoute>} />
              <Route path="/blogs/review" element={<Navigate to="/blogs/dashboard" replace />} />
              <Route path="/blog" element={<Navigate to="/blogs" replace />} />
              <Route path="/blog/category/:tag" element={<BlogCategory />} />
              <Route path="/blog/:slug" element={<LegacyBlogSlugRedirect />} />
              <Route path="/admin" element={<Navigate to="/dashboard/admin" replace />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RoleRedirector />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/user"
                element={
                  <ProtectedRoute>
                    <DashboardUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/guru"
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute roles={["guru", "admin"]}>
                      <DashboardGuru />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute roles={["admin"]}>
                      <DashboardAdmin />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }
              />

              <Route path="/consultations" element={<Consultations />} />
              <Route path="/forums" element={<Forums />} />
              <Route path="/forums/:category_id" element={<ForumCategory />} />
              <Route path="/threads/:thread_id" element={<ThreadView />} />
              
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:id" element={<PublicProfile />} />
              <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
              <Route path="/dashboard/user/progress" element={<UserProgress />} />
<Route path="/guru/questions" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruQuestions /></RoleProtectedRoute>} />
<Route path="/guru/reviews" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruReviewQueue /></RoleProtectedRoute>} />
<Route path="/guru/exams/review" element={<RoleProtectedRoute roles={["guru", "admin"]}><ExamsReviewQueue /></RoleProtectedRoute>} />
<Route path="/guru/reviewed" element={<RoleProtectedRoute roles={["guru", "admin"]}><ReviewedByMe /></RoleProtectedRoute>} />
<Route path="/guru/availability" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruAvailability /></RoleProtectedRoute>} />
              <Route path="/admin/approve-gurus" element={<RoleProtectedRoute roles={["admin"]}><ApproveGurus /></RoleProtectedRoute>} />
              <Route path="/admin/moderate-posts" element={<RoleProtectedRoute roles={["admin", "guru"]}><ModeratePosts /></RoleProtectedRoute>} />
              <Route path="/admin/assign-reviews" element={<RoleProtectedRoute roles={["admin"]}><AssignReviews /></RoleProtectedRoute>} />
              <Route path="/admin/marked-questions" element={<RoleProtectedRoute roles={["admin"]}><MarkedQuestionsAdmin /></RoleProtectedRoute>} />
              <Route path="/admin/question-sets" element={<RoleProtectedRoute roles={["admin"]}><QuestionSetsAdmin /></RoleProtectedRoute>} />
              <Route path="/admin/taxonomy" element={<RoleProtectedRoute roles={["admin"]}><Taxonomy /></RoleProtectedRoute>} />
              <Route path="/admin/exams-curation" element={<RoleProtectedRoute roles={["admin"]}><ExamsAICuration /></RoleProtectedRoute>} />
              <Route path="/about" element={<About />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/tools/generate-exam-question" element={<GenerateExamQuestion />} />
              <Route path="/tools/my-exam-drafts" element={<MyExamDrafts />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/exams/reviewed-exam" element={<ReviewedExamSession />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
