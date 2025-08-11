import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";

const Auth = () => {
  const { user, signInWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useRoles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in | EMGurus";
  }, []);

  useEffect(() => {
    const routeAfterLogin = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, country, specialty, timezone, exams')
          .eq('user_id', user.id)
          .maybeSingle();
        const missing = !data?.full_name || !data?.country || !data?.specialty || !data?.timezone || !(data?.exams && (data.exams as any[]).length > 0);
        if (missing) navigate('/onboarding'); else navigate('/exams');
      } catch {
        navigate('/exams');
      }
    };
    routeAfterLogin();
  }, [user, navigate]);

// One-time: seed test users via Edge Function (admin-only)
useEffect(() => {
  if (!user || !isAdmin) return;
  const already = localStorage.getItem('seed_users_done');
  if (already) return;
  supabase.functions.invoke('seed-test-users')
    .then(({ error }) => {
      if (error) {
        console.error('Seeding failed', error);
        toast.error("Failed to seed test users");
      } else {
        toast.success("Test users seeded: admin, guru, user");
        localStorage.setItem('seed_users_done', '1');
      }
    })
    .catch((e) => {
      console.error('Seed invoke error', e);
      toast.error("Failed to seed test users");
    });
}, [user, isAdmin]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success("Signing in with Google...");
    } catch (error) {
      toast.error("Failed to sign in with Google");
      console.error("Auth error:", error);
    }
  };

  const emailRedirect = `${window.location.origin}/`;

  const handleEmailSignIn = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e?.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSignUp = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: emailRedirect,
        },
      });
      if (error) throw error;
      toast.success("Check your email to confirm your account");
    } catch (e: any) {
      toast.error(e?.message || "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: emailRedirect,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (e: any) {
      toast.error(e?.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Render auth UI even while checking session to avoid long blocking spinners
  // Actions are disabled until loading completes via useAuth
  // (We keep a subtle UX by not showing a full-screen spinner)


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            <div></div>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to EMGurus</h1>
            <p className="text-muted-foreground">
              Sign in to access AI-powered exam preparation and expert mentorship
            </p>
          </div>

          <div className="space-y-6">
            <Button onClick={handleGoogleSignIn} className="w-full" size="lg" variant="secondary">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="reset">Reset</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
                  </div>
                  <Button className="w-full" onClick={handleEmailSignIn} disabled={submitting}>
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="signup">
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
                  </div>
                  <Button className="w-full" onClick={handleEmailSignUp} disabled={submitting}>
                    {submitting ? 'Creating account...' : 'Create Account'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    We'll send a confirmation link to verify your email
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="reset">
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email3">Email</Label>
                    <Input id="email3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <Button className="w-full" onClick={handleResetPassword} disabled={submitting}>
                    {submitting ? 'Sending reset...' : 'Send reset link'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="text-center text-sm text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
