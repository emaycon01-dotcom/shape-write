import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cliente";
  credits: number;
  plano: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  deductCredit: (amount?: number, reason?: string) => Promise<{ ok: boolean; error?: string; credits?: number }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchUserProfile(supabaseUser: SupabaseUser): Promise<User> {
  // Consultas em paralelo (antes eram 3 idas sequenciais ao banco)
  const [blockedRes, profileRes, rolesRes] = await Promise.all([
    supabase
      .from("blocked_users")
      .select("id")
      .eq("user_id", supabaseUser.id)
      .eq("status", "bloqueado")
      .maybeSingle(),
    supabase.from("profiles").select("id, user_id, name, email, credits, plano, created_at").eq("user_id", supabaseUser.id).maybeSingle(),
    supabase.from("user_roles").select("cargo").eq("user_id", supabaseUser.id),
  ]);

  if (blockedRes.data) {
    await supabase.auth.signOut();
    throw new Error("Sua conta foi bloqueada. Entre em contato com o suporte.");
  }

  const profile = profileRes.data as { name?: string; credits?: number; plano?: string; created_at?: string } | null;
  const isAdmin = rolesRes.data?.some((r) => r.cargo === "admin") ?? false;

  return {
    id: supabaseUser.id,
    name: profile?.name || supabaseUser.user_metadata?.name || "",
    email: supabaseUser.email || "",
    role: isAdmin ? "admin" : "cliente",
    credits: profile?.credits ?? 0,
    plano: profile?.plano || "free",
    createdAt: profile?.created_at || supabaseUser.created_at,
  };
}

const USER_CACHE_KEY = "auth_user_cache";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Hidrata instantaneamente com o último perfil conhecido: a interface (créditos,
  // menu lateral, dashboard) aparece na hora enquanto os dados reais chegam.
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(() => readCachedUser() === null);

  useEffect(() => {
    let lastLoadedUserId: string | null = null;
    let inflight: Promise<void> | null = null;

    const applyUser = (u: User | null) => {
      setUser(u);
      writeCachedUser(u);
    };

    const loadProfile = (sessionUser: SupabaseUser) => {
      // Evita buscar o mesmo perfil duas vezes (getSession + onAuthStateChange)
      if (lastLoadedUserId === sessionUser.id && inflight) return inflight;
      lastLoadedUserId = sessionUser.id;
      inflight = fetchUserProfile(sessionUser)
        .then((userData) => applyUser(userData))
        .catch((err) => {
          console.error("Error fetching profile:", err);
          applyUser(null);
          lastLoadedUserId = null;
        })
        .finally(() => setLoading(false));
      return inflight;
    };

    // Listen to auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // setTimeout evita deadlock com o cliente Supabase
          setTimeout(() => { void loadProfile(session.user); }, 0);
        } else {
          lastLoadedUserId = null;
          inflight = null;
          applyUser(null);
          setLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void loadProfile(session.user);
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
        credits: 0,
        plano: "free",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    writeCachedUser(null);
    setUser(null);
    await supabase.auth.signOut();
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      const fresh = await fetchUserProfile(session.user);
      setUser(fresh);
      writeCachedUser(fresh);
    } catch {
      /* ignore */
    }
  }, []);

  const deductCredit = useCallback(
    async (amount: number = 1, reason: string = "geracao") => {
      const { data, error } = await supabase.rpc("consume_credits", {
        _amount: amount,
        _reason: reason,
      });

      if (error) {
        const msg = error.message || "";
        let friendly = "Não foi possível descontar os créditos.";
        if (msg.includes("insufficient_credits")) friendly = "Créditos insuficientes.";
        else if (msg.includes("user_blocked")) friendly = "Sua conta está bloqueada.";
        else if (msg.includes("not_authenticated")) friendly = "Sessão expirada. Entre novamente.";
        await refreshUser();
        return { ok: false, error: friendly };
      }

      const credits = Number(data ?? 0);
      setUser((prev) => {
        const next = prev ? { ...prev, credits } : prev;
        writeCachedUser(next);
        return next;
      });
      return { ok: true, credits };
    },
    [refreshUser]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, register, logout, deductCredit, refreshUser }}
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
