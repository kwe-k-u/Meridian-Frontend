// ── AuthContext ─────────────────────────────────────────────
// Authentication context that manages user session state (token + user profile).
// On mount, restores session from localStorage; provides login/logout/updateProfile actions
// and syncs the auth token with ApiService for automatic HTTP header injection.

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserProfile, LoginResponse, UpdateProfilePayload, Company } from '../types/auth';
import { ApiService } from '../services/api-service';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  updateCompanyInProfile: (companyId: string, patch: Partial<Company>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore the session from localStorage on first mount, so a page refresh doesn't log
  // the user out. If the stored value is missing/corrupt, just clear it and stay logged out
  // rather than throwing — there's no server round trip involved here (the token itself is
  // only validated lazily, the next time an API call actually uses it).
  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user) {
          setToken(parsed.token);
          setUser(parsed.user);
          ApiService.setAuthToken(parsed.token);
        }
      } catch {
        localStorage.removeItem('auth');
      }
    }
  }, []);

  const login = useCallback((data: LoginResponse) => {
    setToken(data.access_token);
    setUser(data.user);
    ApiService.setAuthToken(data.access_token);
    localStorage.setItem('auth', JSON.stringify({ token: data.access_token, user: data.user }));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    ApiService.setAuthToken(null);
    localStorage.removeItem('auth');
  }, []);

  // After the API confirms the profile update, refresh both the in-memory `user` state and
  // the cached copy in localStorage so a page refresh doesn't show stale profile data.
  const updateProfileFn = useCallback(async (payload: UpdateProfilePayload) => {
    const updatedUser = await ApiService.updateProfile(payload);
    setUser(updatedUser);
    const stored = localStorage.getItem('auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.user = updatedUser;
      localStorage.setItem('auth', JSON.stringify(parsed));
    }
  }, []);

  // Patches one company within user.companies in place (e.g. after Settings > Workspace saves
  // a new preferred_currency) — company updates go through ApiService.updateCompany directly
  // rather than through updateProfile above (that's for the user's own profile fields), so
  // nothing else refreshes the cached `user.companies` array; without this, every screen that
  // reads a company field (like preferred_currency, via CurrencyContext) would keep showing
  // the stale value until the next login.
  const updateCompanyInProfile = useCallback((companyId: string, patch: Partial<Company>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        companies: prev.companies.map(c => c.company_id === companyId ? { ...c, ...patch } : c),
      };
      const stored = localStorage.getItem('auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.user = updated;
        localStorage.setItem('auth', JSON.stringify(parsed));
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, updateProfile: updateProfileFn, updateCompanyInProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within an AuthProvider');
  return ctx;
}
