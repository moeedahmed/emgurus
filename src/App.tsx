import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Critical pages - loaded immediately
import Index from "./pages/Index";
import Exams from "./pages/Exams";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Blogs from "./pages/Blogs";
import BlogDetail from "./pages/BlogDetail";
import BlogCategory from "./pages/BlogCategory";
import About from "./pages/About";
import ComingSoon from "./pages/ComingSoon";
import PricingPage from "./pages/Pricing";

// Heavy pages - lazy loaded
const DashboardUser = lazy(() => import("./pages/DashboardUser"));
const DashboardGuru = lazy(() => import("./pages/DashboardGuru"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const DashboardNew = lazy(() => import("./pages/DashboardNew"));
const Forums = lazy(() => import("./pages/Forums"));
const Consultations = lazy(() => import("./pages/Consultations"));

// Blog editor pages - lazy loaded
const EditorNew = lazy(() => import("./pages/blogs/EditorNew"));
const EditorEdit = lazy(() => import("./pages/blogs/EditorEdit"));
const BlogsDashboard = lazy(() => import("./pages/blogs/Dashboard"));

// Exam pages - lazy loaded
const ReviewedQuestionBank = lazy(() => import("@/pages/exams/ReviewedQuestionBank"));
const ReviewedQuestionDetail = lazy(() => import("@/pages/exams/ReviewedQuestionDetail"));
const AiPracticeConfig = lazy(() => import("@/pages/exams/AiPracticeConfig"));
const AiPracticeSession = lazy(() => import("@/pages/exams/AiPracticeSession"));
const PracticeConfig = lazy(() => import("@/pages/exams/PracticeConfig"));
const PracticeSession = lazy(() => import("@/pages/exams/PracticeSession"));
const ExamConfig = lazy(() => import("@/pages/exams/ExamConfig"));
const QuestionBankPage = lazy(() => import("@/pages/exams/QuestionBankPage"));
const QuestionDetail = lazy(() => import("@/pages/exams/QuestionDetail"));
const ReviewedExamSession = lazy(() => import("@/pages/exams/ReviewedExamSession"));
const ExamSession = lazy(() => import("@/pages/exams/ExamSession"));

// Admin pages - lazy loaded
const ExamsAICuration = lazy(() => import("./pages/admin/ExamsAICuration"));
const ApproveGurus = lazy(() => import("./pages/admin/ApproveGurus"));
const ModeratePosts = lazy(() => import("./pages/admin/ModeratePosts"));
const AssignReviews = lazy(() => import("./pages/admin/AssignReviews"));

const MarkedQuestionsAdmin = lazy(() => import("./pages/admin/MarkedQuestions"));
const QuestionSetsAdmin = lazy(() => import("./pages/admin/QuestionSets"));
const QuestionGenerator = lazy(() => import("./pages/admin/QuestionGenerator"));

// Guru pages - lazy loaded
const GuruQuestions = lazy(() => import("./pages/guru/Questions"));
const GuruReviewQueue = lazy(() => import("./pages/guru/ReviewQueue"));
const GuruAvailability = lazy(() => import("./pages/guru/Availability"));
const ExamsReviewQueue = lazy(() => import("./pages/guru/ExamsReviewQueue"));
const ReviewedByMe = lazy(() => import("./pages/guru/ReviewedByMe"));

// User/Profile pages - lazy loaded
const UserProgress = lazy(() => import("./pages/user/Progress"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Bookings = lazy(() => import("./pages/Bookings"));
const SettingsPage = lazy(() => import("./pages/Settings"));

// Forum pages - lazy loaded
const ForumCategory = lazy(() => import("./pages/ForumCategory"));
const ThreadView = lazy(() => import("@/pages/ThreadView"));

// Tool pages - lazy loaded
const GenerateExamQuestion = lazy(() => import("@/pages/tools/GenerateExamQuestion"));
const MyExamDrafts = lazy(() => import("@/pages/tools/MyExamDrafts"));
const SubmitQuestionNew = lazy(() => import("@/pages/tools/SubmitQuestionNew"));
const GenerateBlogDraft = lazy(() => import("@/pages/tools/GenerateBlogDraft"));

// Components and utilities - loaded immediately
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import SiteLayout from "@/components/SiteLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProfileRedirect from "./pages/ProfileRedirect";
import { useRoles } from "@/hooks/useRoles";
import RoleRedirector from "@/components/auth/RoleRedirector";
import AuthLandingGuard from "@/components/auth/AuthLandingGuard";

// Loading fallback component
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);


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

// Component to handle scroll-to-top on route changes
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthLandingGuard />
          <Routes>
            <Route element={<SiteLayout />}> 
              <Route path="/" element={<Index />} />
               <Route path="/exams" element={<Exams />} />
               <Route path="/exams/ai-practice" element={
                 <ErrorBoundary>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <AiPracticeConfig />
                   </Suspense>
                 </ErrorBoundary>
               } />
               <Route path="/exams/ai-practice/session/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <AiPracticeSession />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/practice" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <PracticeConfig />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/exam" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <ExamConfig />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/exam/session" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <ExamSession />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/reviewed" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <ReviewedQuestionBank />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/reviewed/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <QuestionDetail />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/exams/practice/session/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <PracticeSession />
                    </Suspense>
                  </ErrorBoundary>
                } />
               <Route path="/exams/question-bank" element={
                 <ErrorBoundary>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <QuestionBankPage />
                   </Suspense>
                 </ErrorBoundary>
               } />
               <Route path="/exams/question/:id" element={
                 <ErrorBoundary>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <QuestionDetail />
                   </Suspense>
                 </ErrorBoundary>
               } />
               <Route path="/quiz" element={<Navigate to="/exams" replace />} />
               <Route path="/auth" element={<Auth />} />
               <Route path="/auth/callback" element={<Auth />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blogs/:slug" element={<BlogDetail />} />
              <Route path="/blogs/editor/new" element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <EditorNew />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/blogs/editor/:id" element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <EditorEdit />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/blogs/new" element={<Navigate to="/blogs/editor/new" replace />} />
              <Route path="/blogs/dashboard" element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <BlogsDashboard />
                  </Suspense>
                </ProtectedRoute>
              } />
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
                    <Suspense fallback={<PageLoadingFallback />}>
                      <DashboardUser />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/guru"
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute roles={["guru", "admin"]}>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <DashboardGuru />
                      </Suspense>
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute roles={["admin"]}>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <DashboardAdmin />
                      </Suspense>
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-new"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <DashboardNew />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

               <Route path="/consultations" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <Consultations />
                 </Suspense>
               } />
               <Route path="/forums" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <Forums />
                 </Suspense>
               } />
               <Route path="/forums/:category_id" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <ForumCategory />
                 </Suspense>
               } />
               <Route path="/threads/:thread_id" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <ThreadView />
                 </Suspense>
               } />
               
               <Route path="/profile" element={<ProtectedRoute><ProfileRedirect /></ProtectedRoute>} />
               <Route path="/profile/:id" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <PublicProfile />
                 </Suspense>
               } />
               <Route path="/settings" element={
                 <ProtectedRoute>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <SettingsPage />
                   </Suspense>
                 </ProtectedRoute>
               } />
               <Route path="/settings/notifications" element={
                 <ProtectedRoute>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <SettingsPage />
                   </Suspense>
                 </ProtectedRoute>
               } />
               <Route path="/settings/security" element={
                 <ProtectedRoute>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <SettingsPage />
                   </Suspense>
                 </ProtectedRoute>
               } />
               <Route path="/bookings" element={
                 <ProtectedRoute>
                   <Suspense fallback={<PageLoadingFallback />}>
                     <Bookings />
                   </Suspense>
                 </ProtectedRoute>
               } />
               <Route path="/dashboard/user/progress" element={
                 <Suspense fallback={<PageLoadingFallback />}>
                   <UserProgress />
                 </Suspense>
               } />
<Route path="/guru/questions" element={
               <RoleProtectedRoute roles={["guru", "admin"]}>
                 <Suspense fallback={<PageLoadingFallback />}>
                   <GuruQuestions />
                 </Suspense>
               </RoleProtectedRoute>
             } />
            <Route path="/guru/reviews" element={
              <RoleProtectedRoute roles={["guru", "admin"]}>
                <Suspense fallback={<PageLoadingFallback />}>
                  <GuruReviewQueue />
                </Suspense>
              </RoleProtectedRoute>
            } />
            <Route path="/guru/exams/review" element={
              <RoleProtectedRoute roles={["guru", "admin"]}>
                <Suspense fallback={<PageLoadingFallback />}>
                  <ExamsReviewQueue />
                </Suspense>
              </RoleProtectedRoute>
            } />
            <Route path="/tools/submit-question" element={
              <RoleProtectedRoute roles={["guru", "admin"]}>
                <Suspense fallback={<PageLoadingFallback />}>
                  <SubmitQuestionNew />
                </Suspense>
              </RoleProtectedRoute>
            } />
            <Route path="/tools/submit-question/:id" element={
              <RoleProtectedRoute roles={["guru", "admin"]}>
                <Suspense fallback={<PageLoadingFallback />}>
                  <SubmitQuestionNew />
                </Suspense>
              </RoleProtectedRoute>
            } />
<Route path="/guru/reviewed" element={
  <RoleProtectedRoute roles={["guru", "admin"]}>
    <Suspense fallback={<PageLoadingFallback />}>
      <ReviewedByMe />
    </Suspense>
  </RoleProtectedRoute>
} />
<Route path="/guru/availability" element={
  <RoleProtectedRoute roles={["guru", "admin"]}>
    <Suspense fallback={<PageLoadingFallback />}>
      <GuruAvailability />
    </Suspense>
  </RoleProtectedRoute>
} />
              <Route path="/admin/approve-gurus" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ApproveGurus />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/admin/moderate-posts" element={
                <RoleProtectedRoute roles={["admin", "guru"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ModeratePosts />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/admin/assign-reviews" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AssignReviews />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/admin/marked-questions" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <MarkedQuestionsAdmin />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/admin/question-sets" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <QuestionSetsAdmin />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/admin/exams-curation" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ExamsAICuration />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/dashboard/admin/question-generator" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <QuestionGenerator />
                  </Suspense>
                </RoleProtectedRoute>
              } />
              <Route path="/about" element={<About />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/tools/generate-exam-question" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <GenerateExamQuestion />
                </Suspense>
              } />
              <Route path="/tools/my-exam-drafts" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <MyExamDrafts />
                </Suspense>
              } />
              <Route path="/tools/generate-blog-draft" element={
                <RoleProtectedRoute roles={["admin"]}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <GenerateBlogDraft />
                  </Suspense>
                </RoleProtectedRoute>
              } />
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
