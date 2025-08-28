import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AuthReadyState = 'idle' | 'checking' | 'ready';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  authReady: AuthReadyState;
  withAuthFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Reusable authenticated fetch helper with token refresh logic
const createWithAuthFetch = (getSession: () => Session | null, signOut: () => Promise<void>) => {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const makeRequest = async (token?: string): Promise<Response> => {
      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      return fetch(url, {
        ...options,
        headers,
      });
    };

    // First attempt with current session token
    const session = getSession();
    let response = await makeRequest(session?.access_token);
    
    // If 401, try to refresh token and retry once
    if (response.status === 401) {
      try {
        // Wait a bit before retry to allow for token refresh
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Get fresh session
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (freshSession?.access_token) {
          response = await makeRequest(freshSession.access_token);
        }
        
        // If still 401 after retry, sign out
        if (response.status === 401) {
          toast.error('Session expired — please sign in again');
          await signOut();
          return response;
        }
      } catch (error) {
        console.warn('Token refresh failed:', error);
        toast.error('Session expired — please sign in again');
        await signOut();
        return response;
      }
    }

    // Surface non-200 errors via toast (but don't block navigation)
    if (!response.ok && response.status !== 401) {
      try {
        const errorData = await response.clone().json();
        const message = errorData.message || errorData.error || `Request failed (${response.status})`;
        toast.error(message);
      } catch {
        toast.error(`Request failed (${response.status})`);
      }
    }

    return response;
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState<AuthReadyState>('idle');

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      console.warn('Sign out failed, clearing local state anyway', e);
    } finally {
      // Ensure local state is always cleared to avoid being stuck
      setSession(null);
      setUser(null);
    }
  };

  const withAuthFetch = createWithAuthFetch(
    () => session,
    signOut
  );

  // Ensure user has a profile row before setting auth ready
  const ensureProfile = async (user: User) => {
    try {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        // Create profile for new user
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          });

        if (error) {
          console.warn('Failed to create profile:', error);
          // Don't block auth if profile creation fails
        }
      }
    } catch (error) {
      console.warn('Profile check failed:', error);
      // Don't block auth if check fails
    }
  };

  useEffect(() => {
    setAuthReady('checking');
    
    // Set up auth state listener FIRST (single source of truth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only synchronous state updates here
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Ensure profile exists before setting ready
        await ensureProfile(session.user);
        setAuthReady('ready');

        // Handle welcome email for new sign-ins and redirect to original page
        if (event === 'SIGNED_IN' && session?.user?.email) {
          // Defer Supabase calls with setTimeout to avoid recursive auth calls
          setTimeout(async () => {
            try {
              await supabase.functions.invoke('send-welcome-email', {
                headers: { Authorization: `Bearer ${session!.access_token}` },
                body: {
                  user_id: session!.user.id,
                  email: session!.user.email!,
                  full_name:
                    (session!.user.user_metadata as any)?.full_name ||
                    (session!.user.user_metadata as any)?.name ||
                    undefined,
                },
              });
            } catch (e) {
              console.warn('Welcome email invoke failed', e);
            }

            // Handle return URL redirect after successful sign-in
            const returnUrl = localStorage.getItem('authReturnUrl');
            if (returnUrl && returnUrl !== '/auth' && returnUrl !== '/auth/callback' && 
                (window.location.pathname === '/auth' || window.location.pathname === '/auth/callback')) {
              localStorage.removeItem('authReturnUrl');
              window.location.href = returnUrl;
            }
          }, 0);
        }
      } else {
        // No session, auth is ready
        setAuthReady('ready');
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Ensure profile exists before setting ready
        await ensureProfile(session.user);
      }
      setAuthReady('ready');
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Store current location to return to it after auth
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem('authReturnUrl', currentPath);
    
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
  };

  const value = {
    user,
    session,
    signInWithGoogle,
    signOut,
    loading,
    authReady,
    withAuthFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};