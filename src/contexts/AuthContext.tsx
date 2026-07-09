// ── AuthContext ─────────────────────────────────────────────
// Authentication context that manages user session state (token + user profile).
// On mount, restores session from localStorage; provides login/logout/updateProfile actions
// and syncs the auth token with ApiService for automatic HTTP header injection.

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserProfile, LoginResponse, UpdateProfilePayload } from '../types/auth';
import { ApiService } from '../services/api-service';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore the session from localStorage on first mount, so a page refresh doesn't log
  // the user out. After restoring the token we immediately call /auth/me to get a fresh
  // user object — this picks up companies, role, and any profile changes that happened
  // since the token was issued without requiring the user to log out and back in.
  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.token && parsed.user) {
        setToken(parsed.token);
        setUser(parsed.user);
        ApiService.setAuthToken(parsed.token);
        ApiService.getMe().then(data => {
          setUser(data.user);
          parsed.user = data.user;
          localStorage.setItem('auth', JSON.stringify(parsed));
        }).catch(() => {});
      }
    } catch {
      localStorage.removeItem('auth');
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

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, updateProfile: updateProfileFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within an AuthProvider');
  return ctx;
}
