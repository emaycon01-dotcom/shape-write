import React, { createContext, useContext, useState, useCallback } from "react";

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
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  deductCredit: (amount?: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo users for frontend prototype
const DEMO_USERS: (User & { password: string })[] = [
  {
    id: "1",
    name: "Admin",
    email: "admin@bellarus.com",
    password: "Erika.2004",
    role: "admin",
    credits: 999,
    createdAt: "2026-03-01",
  },
  {
    id: "2",
    name: "Usuário Demo",
    email: "demo@bellarus.com",
    password: "demo123",
    role: "cliente",
    credits: 10,
    createdAt: "2026-03-10",
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("bellarus_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const found = DEMO_USERS.find(
      (u) => u.email === email && u.password === password
    );
    if (!found) throw new Error("Credenciais inválidas");
    const { password: _, ...userData } = found;
    setUser(userData);
    localStorage.setItem("bellarus_user", JSON.stringify(userData));
  }, []);

  const register = useCallback(
    async (name: string, email: string, _password: string) => {
      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        email,
        role: "cliente",
        credits: 5,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUser(newUser);
      localStorage.setItem("bellarus_user", JSON.stringify(newUser));
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("bellarus_user");
  }, []);

  const deductCredit = useCallback(() => {
    setUser((prev) => {
      if (!prev || prev.credits < 1) return prev;
      const updated = { ...prev, credits: prev.credits - 1 };
      localStorage.setItem("bellarus_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, register, logout, deductCredit }}
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
