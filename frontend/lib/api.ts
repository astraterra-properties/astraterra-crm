/**
 * API Configuration — Astraterra CRM
 * Reads NEXT_PUBLIC_API_URL from environment, falls back to localhost:3001
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Authenticated fetch wrapper
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  return res;
}

/**
 * WhatsApp click-to-chat URL
 */
export function whatsappUrl(phone: string, message?: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const base = `https://wa.me/${cleaned}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
