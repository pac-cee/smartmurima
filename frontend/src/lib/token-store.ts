import type { User } from './schemas';

/**
 * Both tokens are persisted so a hard reload can render authenticated data on
 * first paint without a 401->refresh round-trip; the refresh flow remains the
 * fallback when the stored access token has expired. A tiny pub/sub lets React
 * subscribe.
 */
const ACCESS_KEY = 'sm_access';
const REFRESH_KEY = 'sm_refresh';
const USER_KEY = 'sm_user';

let accessToken: string | null =
  typeof window === 'undefined' ? null : window.localStorage.getItem(ACCESS_KEY);
let currentUser: User | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: (): string | null =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_KEY),
  getUser: (): User | null => {
    if (currentUser) return currentUser;
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      currentUser = JSON.parse(raw) as User;
      return currentUser;
    } catch {
      return null;
    }
  },
  setSession(access: string, refresh: string, user?: User) {
    accessToken = access;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_KEY, access);
      window.localStorage.setItem(REFRESH_KEY, refresh);
      if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    if (user) currentUser = user;
    emit();
  },
  setAccess(access: string) {
    accessToken = access;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_KEY, access);
    }
    emit();
  },
  setUser(user: User) {
    currentUser = user;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    emit();
  },
  clear() {
    accessToken = null;
    currentUser = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isAuthenticated: () => Boolean(accessToken ?? tokenStore.getRefresh()),
};
