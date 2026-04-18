import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { User } from '@lecpunch/shared';

const LEGACY_TOKEN_KEY = 'lecpunch.token';
const LEGACY_USER_KEY = 'lecpunch.user';

interface AuthSnapshot {
  token: string | null;
  user: User | null;
}

interface PersistedAuthState {
  state?: {
    auth?: AuthSnapshot;
  };
}

const readLegacyAuth = (): AuthSnapshot => {
  const token = localStorage.getItem(LEGACY_TOKEN_KEY);
  const rawUser = localStorage.getItem(LEGACY_USER_KEY);

  if (!token || !rawUser) {
    if (token && !rawUser) {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    if (rawUser && !token) {
      localStorage.removeItem(LEGACY_USER_KEY);
    }
    return { token: null, user: null };
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser) as User
    };
  } catch {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    return { token: null, user: null };
  }
};

const authStorage: StateStorage = {
  getItem: () => {
    const auth = readLegacyAuth();
    if (!auth.token || !auth.user) {
      return null;
    }
    return JSON.stringify({
      state: {
        auth
      }
    });
  },
  setItem: (_name, value) => {
    try {
      const parsed = JSON.parse(value) as PersistedAuthState;
      const auth = parsed.state?.auth;
      if (!auth?.token || !auth.user) {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.removeItem(LEGACY_USER_KEY);
        return;
      }

      localStorage.setItem(LEGACY_TOKEN_KEY, auth.token);
      localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(auth.user));
    } catch {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
    }
  },
  removeItem: () => {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  }
};

export interface AuthStoreState {
  auth: AuthSnapshot;
  authInitializing: boolean;
  setAuth: (payload: AuthSnapshot) => void;
  updateUser: (patch: Partial<User>) => void;
  setAuthInitializing: (value: boolean) => void;
  logout: () => void;
}

const EMPTY_AUTH: AuthSnapshot = {
  token: null,
  user: null
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      auth: EMPTY_AUTH,
      authInitializing: false,
      setAuth: (payload) => set({ auth: payload }),
      updateUser: (patch) =>
        set((state) => ({
          auth: {
            ...state.auth,
            user: state.auth.user ? { ...state.auth.user, ...patch } : null
          }
        })),
      setAuthInitializing: (value) => set({ authInitializing: value }),
      logout: () => set({ auth: EMPTY_AUTH })
    }),
    {
      name: 'lecpunch.auth',
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        auth: state.auth
      })
    }
  )
);
