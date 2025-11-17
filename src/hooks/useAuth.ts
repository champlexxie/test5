import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    // Don't create profile here - it will be created after email verification
    // The profile creation should happen in a database trigger or after verification

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Check if email is verified
    if (result.data.user && !result.data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: {
          message: 'Please verify your email before signing in. Check your inbox for the verification link.',
        },
      };
    }

    // Create profile if it doesn't exist (for verified users)
    if (result.data.user && result.data.user.email_confirmed_at) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', result.data.user.id)
        .single();

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: result.data.user.id,
          email: result.data.user.email,
          full_name: result.data.user.user_metadata?.full_name || '',
        });
      }
    }

    return result;
  };

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };
}
