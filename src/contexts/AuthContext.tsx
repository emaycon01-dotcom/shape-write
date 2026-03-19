import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cliente";
  credits: number;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  deductCredit: (amount?: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchUserProfile(supabaseUser: SupabaseUser): Promise<User> {
  // Check if user is blocked
  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("user_id", supabaseUser.id)
    .eq("status", "bloqueado")
    .maybeSingle();

  if (blocked) {
    await supabase.auth.signOut();
    throw new Error("Sua conta foi bloqueada. Entre em contato com o suporte.");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", supabaseUser.id)
    .single();

  // Fetch role
  const { data: roles } = await supabase
    .from("user_roles")
    .select("cargo")
    .eq("user_id", supabaseUser.id);

  const isAdmin = roles?.some((r) => r.cargo === "admin") ?? false;

  return {
    id: supabaseUser.id,
    name: profile?.name || supabaseUser.user_metadata?.name || "",
    email: supabaseUser.email || "",
    role: isAdmin ? "admin" : "cliente",
    credits: profile?.credits ?? 0,
    createdAt: profile?.created_at || supabaseUser.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(async () => {
            try {
              const userData = await fetchUserProfile(session.user);
              setUser(userData);
            } catch (err) {
              console.error("Error fetching profile:", err);
              setUser(null);
            }
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user).then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);

    // Create profile for the new user
    if (data.user) {
      await supabase.from("profiles").insert({
        user_id: data.user.id,
        email,
        name,
        credits: 5,
        plano: "free",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const deductCredit = useCallback(async (amount: number = 1) => {
    if (!user || user.credits < amount) return;

    const { data, error } = await supabase.functions.invoke("deduct-credit", {
      body: { amount },
    });

    if (!error && data?.credits !== undefined) {
      setUser((prev) => prev ? { ...prev, credits: data.credits } : prev);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, register, logout, deductCredit }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
