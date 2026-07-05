// ── Auth Types ───────────────────────────────────────────────
// Types for authentication responses, user profiles, company associations,
// and profile update payloads used throughout the auth flow.

// Returned by POST /auth/login, /auth/register-company, and Google sign-in (also routed
// through /auth/login with a provider_token — see ApiService.googleLogin/loginUser).
// Stored as-is in localStorage by AuthContext so the session survives a page refresh.
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

// The authenticated user, as returned by AuthController::issueSessionToken() — a raw User
// model with the `companies` relation eager-loaded (unlike DashboardController's `user`,
// which does NOT include companies — see DashboardResponse.user in types/app.ts).
export interface UserProfile {
  user_id: string;
  firebase_uid: string | null;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  email_verified_at: string | null;
  last_login: string;
  created_at: string;
  updated_at: string;
  companies: Company[];
}

export interface Company {
  company_id: string;
  company_name: string;
  country: string;
  city_of_operation: string;
  status: number;
  created_at: string;
  updated_at: string;
  // See the identical comment on CompanyUser.pivot in types/app.ts: is_default/is_enabled
  // are 0/1 (not real booleans), and is_enabled marks the user's currently *active* company.
  pivot: {
    user_id: string;
    company_id: string;
    role: string;
    is_default: number;
    is_enabled: number;
    joined_at: string;
  };
}

export interface UpdateProfilePayload {
  display_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}
