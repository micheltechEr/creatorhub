// @refresh reset
import React, { createContext, useContext, useState, useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    setIsAuthenticated(!!token);
    setAuthTokenGetter(() => localStorage.getItem("accessToken") ?? null);
  }, []);

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Call this after every API response that could be a 429 from an auth endpoint.
 * Returns true if the redirect was triggered (caller should stop processing).
 *
 * The server sends { redirectTo: "/" } on brute-force lockout —
 * this ensures the attacker's browser is always pushed back to the home page.
 */
export function handleAuthRateLimit(
  error: unknown,
  navigateFn: (path: string) => void,
): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; response?: { status?: number; data?: { redirectTo?: string } } };

  const status = err.status ?? err.response?.status;
  if (status === 429) {
    const redirectTo = err.response?.data?.redirectTo ?? "/";
    navigateFn(redirectTo);
    return true;
  }
  return false;
}
