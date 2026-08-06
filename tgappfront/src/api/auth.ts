import { api } from "./client";
import type { AuthResponse, AuthUser } from "../types/auth";

export async function login(data: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/login", data);
}

export async function register(data: {
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  password: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/register", data);
}

export async function fetchMe(): Promise<AuthUser> {
  return api.get<AuthUser>("/api/auth/me");
}

export async function setPassword(password: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>("/api/auth/set-password", { password });
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
}): Promise<AuthResponse> {
  return api.patch<AuthResponse>("/api/auth/profile", data);
}

export async function telegramAuth(initData: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/telegram", { initData });
}

export async function vkAuth(data: {
  access_token: string;
  user_id: number;
  email?: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/vk", data);
}

export async function mergeCart(items: Array<{ id: number; quantity: number }>): Promise<void> {
  await api.post("/api/cart/merge", { items });
}

export async function googleAuth(credential: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/google", { credential });
}

export async function telegramBrowserAuth(data: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
  hash?: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/telegram/browser", data);
}

export async function vkCodeAuth(code: string, redirectUri: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/vk/code", { code, redirect_uri: redirectUri });
}
