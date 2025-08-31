import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

  useEffect(() => {
    setAuthReady('checking');
    
    // Set up auth state listener FIRST (single source of truth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only synchronous state updates here
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setAuthReady('ready');

      // Handle welcome email for new sign-ins
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
        }, 0);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setAuthReady('ready');
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/auth`;
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