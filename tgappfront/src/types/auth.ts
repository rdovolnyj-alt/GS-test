export type UserRole = "user" | "admin" | "courier";

export type AuthProvider = "local" | "telegram" | "vk" | "google";

export interface IdentityInfo {
  provider: AuthProvider;
  provider_user_id: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  providers: AuthProvider[];
  identities: IdentityInfo[];
  has_password: boolean;
  created_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
