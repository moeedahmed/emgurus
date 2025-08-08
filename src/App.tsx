import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Quiz from "./pages/Quiz";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogCategory from "./pages/BlogCategory";
import Editor from "./pages/Editor";
import Review from "./pages/Review";
import Admin from "./pages/Admin";
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
import ApproveGurus from "./pages/admin/ApproveGurus";
import ModeratePosts from "./pages/admin/ModeratePosts";
import AssignReviews from "./pages/admin/AssignReviews";
import Taxonomy from "./pages/admin/Taxonomy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<SiteLayout />}> 
              <Route path="/" element={<Index />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/category/:tag" element={<BlogCategory />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/review" element={<Review />} />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <RoleProtectedRoute roles={["admin"]}>
                    <Admin />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
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
                    <DashboardGuru />
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

              <Route path="/forums" element={<Forums />} />
              <Route path="/consultations" element={<Consultations />} />
              <Route path="/dashboard/user/progress" element={<UserProgress />} />
              <Route path="/guru/questions" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruQuestions /></RoleProtectedRoute>} />
              <Route path="/guru/reviews" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruReviewQueue /></RoleProtectedRoute>} />
              <Route path="/guru/availability" element={<RoleProtectedRoute roles={["guru", "admin"]}><GuruAvailability /></RoleProtectedRoute>} />
              <Route path="/admin/approve-gurus" element={<RoleProtectedRoute roles={["admin"]}><ApproveGurus /></RoleProtectedRoute>} />
              <Route path="/admin/moderate-posts" element={<RoleProtectedRoute roles={["admin"]}><ModeratePosts /></RoleProtectedRoute>} />
              <Route path="/admin/assign-reviews" element={<RoleProtectedRoute roles={["admin"]}><AssignReviews /></RoleProtectedRoute>} />
              <Route path="/admin/taxonomy" element={<RoleProtectedRoute roles={["admin"]}><Taxonomy /></RoleProtectedRoute>} />
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
