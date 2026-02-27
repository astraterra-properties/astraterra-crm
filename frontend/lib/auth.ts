/**
 * RBAC helper utilities for Astraterra CRM
 * Role hierarchy: agent < marketing < admin < owner
 */

export type UserRole = 'owner' | 'admin' | 'marketing' | 'agent';

export const ROLE_LEVELS: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  marketing: 2,
  agent: 1,
};

export function getUserRole(): UserRole {
  if (typeof window === 'undefined') return 'agent';
  return (localStorage.getItem('userRole') as UserRole) || 'agent';
}

export function hasMinRole(minRole: UserRole): boolean {
  const userLevel = ROLE_LEVELS[getUserRole()] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 99;
  return userLevel >= requiredLevel;
}

export function isOwner(): boolean {
  return getUserRole() === 'owner';
}

export function isAdmin(): boolean {
  return hasMinRole('admin');
}

export function isMarketing(): boolean {
  return hasMinRole('marketing');
}

export function isAgent(): boolean {
  return getUserRole() === 'agent';
}

export function isMarketingOnly(): boolean {
  return getUserRole() === 'marketing';
}
