import { compare } from 'bcryptjs';
import { supabase } from './supabase';

export type AdminRole = 'admin' | 'manager' | 'seller';

export interface AdminUser {
  id: string;
  first_name: string;
  email: string;
  role: AdminRole;
  _token?: string;
}

const STORAGE_KEY = 'styletech_admin';

function hashToken(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser | null> {
  const emailLower = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from('admin_accounts')
    .select('id, email, first_name, role, is_active, password_hash')
    .eq('email', emailLower)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  if (!data.password_hash) return null;

  const passwordMatch = await compare(password, data.password_hash);
  if (!passwordMatch) return null;

  const token = crypto.randomUUID();
  await supabase
    .from('admin_accounts')
    .update({ last_login_at: new Date().toISOString(), session_token: hashToken(token) })
    .eq('id', data.id);

  const user: AdminUser = {
    id: data.id,
    first_name: data.first_name,
    email: data.email,
    role: data.role as AdminRole,
    _token: token,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function verifyAdminSession(): Promise<boolean> {
  const user = getCurrentAdmin();
  if (!user || !user._token) return false;

  const { data } = await supabase
    .from('admin_accounts')
    .select('id')
    .eq('id', user.id)
    .eq('session_token', hashToken(user._token))
    .eq('is_active', true)
    .maybeSingle();

  return !!data;
}

export function getCurrentAdmin(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function canManageUsers(user: AdminUser | null): boolean {
  return user?.role === 'admin';
}

export function canManageOrders(user: AdminUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'manager';
}

export function canManageProducts(user: AdminUser | null): boolean {
  return !!user;
}

export function canManageBanners(user: AdminUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'manager';
}

export function canManageDelivery(user: AdminUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'manager';
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  seller: 'Продавец',
};
