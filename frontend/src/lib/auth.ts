/**
 * Authentication utilities
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// Token storage
const ACCESS_TOKEN_KEY = 'nsr_access_token';
const REFRESH_TOKEN_KEY = 'nsr_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/auth/login/google`;
}

export interface DevStatus {
  dev_login_available: boolean;
  google_oauth_configured: boolean;
  local_login_available: boolean;
}

export async function getDevStatus(): Promise<DevStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/dev-status`);
    if (!response.ok) {
      return { dev_login_available: false, google_oauth_configured: false, local_login_available: true };
    }
    return response.json();
  } catch {
    return { dev_login_available: false, google_oauth_configured: false, local_login_available: true };
  }
}

export interface LocalLoginResult {
  success: boolean;
  error?: string;
}

export async function localLogin(email: string, password: string): Promise<LocalLoginResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.detail || 'Erro ao fazer login' };
    }
    
    const data = await response.json();
    setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
    return { success: true };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function devLogin(email: string, name: string, isAdmin: boolean = true): Promise<AuthTokens | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, is_admin: isAdmin }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
    return data;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      // Try to refresh
      const refreshed = await refreshTokens();
      if (!refreshed) {
        clearTokens();
        return null;
      }
      // Retry with new token
      return getCurrentUser();
    }

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

export async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    return true;
  } catch (error) {
    console.error('Failed to refresh tokens:', error);
    clearTokens();
    return false;
  }
}

export async function logout(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  clearTokens();
}

// Authenticated fetch wrapper
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token expiration
  if (response.status === 401 && token) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry with new token
      headers.set('Authorization', `Bearer ${getAccessToken()}`);
      return fetch(url, { ...options, headers });
    }
  }

  return response;
}
