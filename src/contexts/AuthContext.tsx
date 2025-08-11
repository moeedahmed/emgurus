import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only synchronous state updates here
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Defer any Supabase calls to avoid deadlocks
      if (event === 'SIGNED_IN' && session?.user?.email) {
        setTimeout(async () => {
          try {
            await supabase.functions.invoke('send-welcome-email', {
              body: {
                user_id: session.user.id,
                email: session.user.email,
                full_name:
                  (session.user.user_metadata as any)?.full_name ||
                  (session.user.user_metadata as any)?.name ||
                  undefined,
              },
            });
          } catch (e) {
            console.warn('Welcome email invoke failed', e);
          }
        }, 0);
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
  };

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

  const value = {
    user,
    session,
    signInWithGoogle,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};