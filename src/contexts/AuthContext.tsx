import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "gerente" | "cliente";
  credits: number;
  plano: string;
  createdAt: string;
  /** Conta liberada pelo staff para ver e gerar documentos. */
  verified: boolean;
}


interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  deductCredit: (amount?: number, reason?: string, ref?: string) => Promise<{ ok: boolean; error?: string; credits?: number }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const PENDING_MSG = "Sua conta está em análise. Aguarde a aprovação de um administrador.";
export const REJECTED_MSG = "Seu acesso foi recusado pela administração.";

/**
 * Registra o perfil pendente via serviço quando o signUp não devolve sessão
 * (confirmação de e-mail ativa) e o RLS impede a inserção pelo cliente.
 */
const PROFILE_BRIDGE_URL =
  "https://doycwownddyxfqntifca.supabase.co/functions/v1/create-pending-profile";
const PROFILE_BRIDGE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWN3b3duZGR5eGZxbnRpZmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDYzMTYsImV4cCI6MjA4OTAyMjMxNn0.kpk695Xomza4QBmD8FtdkNSMmJS1bFQyc6YSuvxpEbI";

async function ensurePendingProfile(userId: string, email: string, name: string) {
  try {
    const res = await fetch(PROFILE_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PROFILE_BRIDGE_KEY },
      body: JSON.stringify({ user_id: userId, email, name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error("Não foi possível concluir o cadastro. Tente novamente.");
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error("Não foi possível concluir o cadastro.");
  }
}


async function fetchUserProfile(supabaseUser: SupabaseUser): Promise<User> {
  // Consultas em paralelo (antes eram 3 idas sequenciais ao banco)
  const [blockedRes, profileRes, rolesRes] = await Promise.all([
    supabase
      .from("blocked_users")
      .select("id")
      .eq("user_id", supabaseUser.id)
      .eq("status", "bloqueado")
      .maybeSingle(),
    supabase.from("profiles").select("id, user_id, name, email, credits, plano, created_at, status, verified").eq("user_id", supabaseUser.id).maybeSingle(),
    supabase.from("user_roles").select("cargo").eq("user_id", supabaseUser.id),
  ]);

  if (blockedRes.data) {
    await supabase.auth.signOut();
    throw new Error("Sua conta foi bloqueada. Entre em contato com o suporte.");
  }

  const profile = profileRes.data as { name?: string; credits?: number; plano?: string; created_at?: string; status?: string; verified?: boolean } | null;
  const cargos = rolesRes.data?.map((r) => r.cargo) ?? [];
  const isAdmin = cargos.includes("admin");
  const isGerente = cargos.includes("gerente");
  const isStaff = isAdmin || isGerente;

  const status = profile?.status ?? "pendente";
  if (!isStaff && status !== "aprovado") {
    await supabase.auth.signOut();
    throw new Error(status === "rejeitado" ? REJECTED_MSG : PENDING_MSG);
  }

  return {
    id: supabaseUser.id,
    name: profile?.name || supabaseUser.user_metadata?.name || "",
    email: supabaseUser.email || "",
    role: isAdmin ? "admin" : isGerente ? "gerente" : "cliente",
    credits: Number(profile?.credits ?? 0) || 0,
    plano: profile?.plano || "free",
    createdAt: profile?.created_at || supabaseUser.created_at,
    verified: isStaff ? true : profile?.verified === true,
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

    // Mantém os créditos sempre atualizados: ao voltar para a aba/janela e
    // periodicamente, evitando saldo antigo vindo do cache local.
    const revalidate = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          lastLoadedUserId = null;
          inflight = null;
          void loadProfile(session.user);
        }
      });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(revalidate, 20_000);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  // Saldo em tempo real: qualquer alteração de créditos/plano feita pelo painel
  // (ou por uma recarga PIX) reflete na hora, sem esperar o próximo ciclo.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { credits?: number; plano?: string; verified?: boolean; status?: string };
          setUser((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              credits: Number(row?.credits ?? prev.credits) || 0,
              plano: row?.plano || prev.plano,
              verified: prev.role === "cliente" ? row?.verified === true : prev.verified,
            };
            writeCachedUser(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      const [{ data: prof }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("status").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("user_roles").select("cargo").eq("user_id", data.user.id),
      ]);
      const isStaff = roleRows?.some((r) => r.cargo === "admin" || r.cargo === "gerente") ?? false;
      const status = (prof as { status?: string } | null)?.status ?? "pendente";
      if (!isStaff && status !== "aprovado") {
        await supabase.auth.signOut();
        throw new Error(status === "rejeitado" ? REJECTED_MSG : PENDING_MSG);
      }
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);

    // Cria o perfil do novo cadastro (fica pendente até aprovação do admin).
    if (data.user) {
      let created = false;
      if (data.session) {
        const { error: insErr } = await supabase.from("profiles").insert({
          user_id: data.user.id,
          email,
          name,
          credits: 0,
          plano: "free",
          status: "pendente",
        });
        created = !insErr;
      }

      // Sem sessão (confirmação de e-mail ativa) o RLS bloqueia a inserção:
      // o perfil é criado pelo serviço para a conta entrar na fila de aprovação.
      if (!created) {
        await ensurePendingProfile(data.user.id, email, name);
      }
    }
    await supabase.auth.signOut();
  }, []);



  const logout = useCallback(async () => {
    writeCachedUser(null);
    try { sessionStorage.removeItem("documents_cache"); } catch { /* ignore */ }
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
    async (amount: number = 1, reason: string = "geracao", ref?: string) => {
      let { data, error } = await supabase.rpc("consume_credits", {
        _amount: amount,
        _reason: reason,
        _ref: ref ?? null,
      });

      // Compatibilidade durante a migração: alguns ambientes ainda expõem a
      // assinatura anterior, sem `_ref`. Nesse caso o gateway responde 404
      // mesmo com a cobrança atômica disponível e o PDF pronto era descartado.
      const missingNewSignature = error && (
        error.code === "PGRST202" ||
        error.message?.includes("Could not find the function") ||
        error.message?.includes("schema cache")
      );
      if (missingNewSignature) {
        const legacy = await supabase.rpc("consume_credits", {
          _amount: amount,
          _reason: reason,
        });
        data = legacy.data;
        error = legacy.error;
      }

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
